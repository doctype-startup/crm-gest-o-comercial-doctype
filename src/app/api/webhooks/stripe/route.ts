import type Stripe from "stripe";
import { db, ensureSchema } from "@/lib/db";
import { notifyUsers, usersWithModuleAccess } from "@/lib/notifications";
import { getStripe } from "@/lib/stripe";
import { billingMethodFromStripeType, invoiceSubscriptionId, isoDateFromUnix, stripeEventStream, stripeId } from "@/lib/stripe-billing";
import { invalidateState } from "@/lib/state-cache";

export const runtime = "nodejs";

async function resolveSubscriptionPaymentMethod(subscriptionId: string) {
  if (!subscriptionId) return null;
  try {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId, { expand: ["default_payment_method"] });
    const paymentMethod = subscription.default_payment_method;
    const type = typeof paymentMethod === "string" ? undefined : paymentMethod?.type;
    return billingMethodFromStripeType(type);
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      message: "Failed to resolve Stripe subscription payment method",
      route: "/api/webhooks/stripe",
      subscriptionId,
      error: error instanceof Error ? error.message : String(error),
    }));
    return null;
  }
}

async function organizationForEvent(event: Stripe.Event) {
  const object = event.data.object;
  if (event.type.startsWith("checkout.session.")) {
    const checkout = object as Stripe.Checkout.Session;
    return checkout.metadata?.orgId || checkout.client_reference_id || "";
  }
  if (event.type.startsWith("customer.subscription.")) {
    const subscription = object as Stripe.Subscription;
    if (subscription.metadata?.orgId) return subscription.metadata.orgId;
    const row = await db.selectFrom("saas_billing").select("org_id").where("external_subscription_id", "=", subscription.id).executeTakeFirst();
    return row?.org_id || "";
  }
  if (event.type.startsWith("invoice.")) {
    const invoice = object as Stripe.Invoice;
    const subscriptionId = invoiceSubscriptionId(invoice);
    if (subscriptionId) {
      const row = await db.selectFrom("saas_billing").select("org_id").where("external_subscription_id", "=", subscriptionId).executeTakeFirst();
      if (row) return row.org_id;
    }
    const customerId = stripeId(invoice.customer);
    const row = customerId ? await db.selectFrom("saas_billing").select("org_id").where("external_customer_id", "=", customerId).executeTakeFirst() : undefined;
    return row?.org_id || "";
  }
  return "";
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return Response.json({ error: "Stripe não configurada." }, { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Assinatura ausente." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return Response.json({ error: "Assinatura inválida." }, { status: 400 });
  }

  await ensureSchema();
  const orgId = await organizationForEvent(event);
  if (!orgId) return Response.json({ received: true, ignored: true });
  const isClientInvoiceCheckout = event.type.startsWith("checkout.session.") && (event.data.object as Stripe.Checkout.Session).metadata?.kind === "client_invoice";
  // Cobranças de fatura de cliente usam um stream de ordenação próprio: elas não têm
  // relação com a assinatura SaaS da própria empresa (saas_billing) e não devem competir
  // pelo mesmo cursor "checkout" — cada fatura tem seu próprio recordId em metadata.
  const stream = isClientInvoiceCheckout ? "checkout-invoice" : stripeEventStream(event.type);
  if (!stream) return Response.json({ received: true, ignored: true });

  const checkoutPaymentMethod = event.type.startsWith("checkout.session.")
    ? await resolveSubscriptionPaymentMethod(stripeId((event.data.object as Stripe.Checkout.Session).subscription))
    : null;

  // Devolvido pela transação quando uma fatura de cliente é confirmada como paga —
  // a notificação (central + e-mail) só dispara depois do commit, fora da transação,
  // pra não segurar a conexão com o banco esperando o envio do e-mail.
  type PaidInvoice = { value: number; description: string; clientName: string };

  const paidInvoice: PaidInvoice | null = await db.transaction().execute(async (trx): Promise<PaidInvoice | null> => {
    let result: PaidInvoice | null = null;
    const now = new Date().toISOString();
    const inserted = await trx.insertInto("stripe_events")
      .values({ id: event.id, org_id: orgId, type: event.type, event_created: event.created, processed_at: now })
      .onConflict((conflict) => conflict.column("id").doNothing())
      .returning("id")
      .executeTakeFirst();
    if (!inserted) return result;

    const cursor = await trx.selectFrom("stripe_event_cursors").select("event_created").where("org_id", "=", orgId).where("stream", "=", stream).executeTakeFirst();
    const isCurrent = !cursor || event.created >= cursor.event_created;

    if (isCurrent && event.type.startsWith("checkout.session.") && isClientInvoiceCheckout) {
      const checkout = event.data.object as Stripe.Checkout.Session;
      const recordId = checkout.metadata?.recordId || "";
      const failed = event.type === "checkout.session.async_payment_failed";
      const paid = event.type === "checkout.session.async_payment_succeeded" || checkout.payment_status === "paid" || checkout.payment_status === "no_payment_required";
      const record = recordId
        ? await trx.selectFrom("records").select(["id", "data"]).where("id", "=", recordId).where("org_id", "=", orgId).where("module", "=", "invoices").executeTakeFirst()
        : undefined;
      if (record) {
        const data = JSON.parse(record.data) as Record<string, unknown>;
        const nextData = paid
          ? { ...data, status: "Pago", paidAt: data.paidAt || now.slice(0, 10), paymentLinkStatus: "Pago" }
          : { ...data, paymentLinkStatus: failed ? "Falhou" : "Pendente" };
        await trx.updateTable("records").set({ data: JSON.stringify(nextData), updated_at: now }).where("id", "=", recordId).where("org_id", "=", orgId).execute();
        invalidateState(orgId);
        if (paid) {
          const clientRow = data.clientId
            ? await trx.selectFrom("records").select(["data"]).where("id", "=", String(data.clientId)).where("org_id", "=", orgId).where("module", "=", "clients").executeTakeFirst()
            : undefined;
          const clientData = clientRow ? (JSON.parse(clientRow.data) as Record<string, unknown>) : {};
          const clientName = typeof clientData.name === "string" && clientData.name ? clientData.name : "um cliente";
          result = { value: Number(data.value || 0), description: String(data.description || "Fatura"), clientName };
        }
      }
    }

    if (isCurrent && event.type.startsWith("checkout.session.") && !isClientInvoiceCheckout) {
      const checkout = event.data.object as Stripe.Checkout.Session;
      const failed = event.type === "checkout.session.async_payment_failed";
      const paid = event.type === "checkout.session.async_payment_succeeded" || checkout.payment_status === "paid" || checkout.payment_status === "no_payment_required";
      await trx.updateTable("saas_billing").set({
        external_customer_id: stripeId(checkout.customer),
        external_subscription_id: stripeId(checkout.subscription),
        ...(checkoutPaymentMethod ? { payment_method: checkoutPaymentMethod } : {}),
        payment_status: failed ? "Atrasado" : paid ? "Em dia" : "Pendente",
        updated_at: now,
      }).where("org_id", "=", orgId).execute();
      // Fecha o loop do cadastro self-service: assim que a primeira cobrança é
      // confirmada, a empresa sai de "Teste" para "Ativo" sem depender da DOCTYPE.
      if (paid) await trx.updateTable("saas_accounts").set({ status: "Ativo", updated_at: now }).where("org_id", "=", orgId).where("status", "=", "Teste").execute();
    }

    if (isCurrent && event.type.startsWith("invoice.")) {
      const invoice = event.data.object as Stripe.Invoice;
      const succeeded = event.type === "invoice.payment_succeeded" || event.type === "invoice.paid";
      const failed = event.type === "invoice.payment_failed";
      if (succeeded || failed || event.type === "invoice.payment_action_required") {
        await trx.updateTable("saas_billing").set({
          external_customer_id: stripeId(invoice.customer),
          external_subscription_id: invoiceSubscriptionId(invoice),
          payment_status: succeeded ? "Em dia" : failed ? "Atrasado" : "Pendente",
          next_charge_date: isoDateFromUnix(invoice.period_end),
          updated_at: now,
        }).where("org_id", "=", orgId).execute();
        if (succeeded) await trx.updateTable("saas_accounts").set({ status: "Ativo", updated_at: now }).where("org_id", "=", orgId).where("status", "=", "Teste").execute();
      }
    }

    if (isCurrent && event.type.startsWith("customer.subscription.")) {
      const subscription = event.data.object as Stripe.Subscription;
      const removed = event.type === "customer.subscription.deleted";
      const overdue = ["past_due", "unpaid", "incomplete_expired"].includes(subscription.status);
      const subscriptionUpdate = {
        external_customer_id: stripeId(subscription.customer),
        external_subscription_id: removed ? "" : subscription.id,
        updated_at: now,
      };
      await trx.updateTable("saas_billing").set(overdue || removed
        ? { ...subscriptionUpdate, payment_status: overdue ? "Atrasado" : "Pendente" }
        : subscriptionUpdate).where("org_id", "=", orgId).execute();
    }

    if (isCurrent) {
      await trx.insertInto("stripe_event_cursors")
        .values({ org_id: orgId, stream, event_created: event.created, event_id: event.id, updated_at: now })
        .onConflict((conflict) => conflict.columns(["org_id", "stream"]).doUpdateSet({ event_created: event.created, event_id: event.id, updated_at: now }))
        .execute();
    }

    return result;
  });

  if (paidInvoice) {
    const money = paidInvoice.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const recipients = await usersWithModuleAccess(orgId, "invoices");
    await notifyUsers(orgId, recipients, {
      title: "Pagamento recebido",
      body: `${paidInvoice.clientName} pagou "${paidInvoice.description}" — ${money}.`,
      link: "finance",
    });
  }

  return Response.json({ received: true });
}
