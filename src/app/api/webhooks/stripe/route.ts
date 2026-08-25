import type Stripe from "stripe";
import { db, ensureSchema } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { invoiceSubscriptionId, isoDateFromUnix, stripeId } from "@/lib/stripe-billing";

export const runtime = "nodejs";

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

  await db.transaction().execute(async (trx) => {
    const duplicate = await trx.selectFrom("stripe_events").select("id").where("id", "=", event.id).executeTakeFirst();
    if (duplicate) return;

    const newest = await trx.selectFrom("stripe_events").select("event_created").where("org_id", "=", orgId).orderBy("event_created", "desc").executeTakeFirst();
    const isCurrent = !newest || event.created >= newest.event_created;
    const now = new Date().toISOString();

    if (isCurrent && event.type.startsWith("checkout.session.")) {
      const checkout = event.data.object as Stripe.Checkout.Session;
      const failed = event.type === "checkout.session.async_payment_failed";
      const paid = event.type === "checkout.session.async_payment_succeeded" || checkout.payment_status === "paid" || checkout.payment_status === "no_payment_required";
      await trx.updateTable("saas_billing").set({
        external_customer_id: stripeId(checkout.customer),
        external_subscription_id: stripeId(checkout.subscription),
        payment_method: "Pix",
        payment_status: failed ? "Atrasado" : paid ? "Em dia" : "Pendente",
        updated_at: now,
      }).where("org_id", "=", orgId).execute();
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

    await trx.insertInto("stripe_events").values({ id: event.id, org_id: orgId, type: event.type, event_created: event.created, processed_at: now }).execute();
  });

  return Response.json({ received: true });
}
