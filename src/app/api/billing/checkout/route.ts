import { requireSession } from "@/lib/auth";
import { audit, db } from "@/lib/db";
import { apiError, assertSameOrigin, HttpError } from "@/lib/http";
import { getStripe, stripeIsTestMode } from "@/lib/stripe";
import { stripeCycle } from "@/lib/stripe-billing";

export const runtime = "nodejs";

type StripeFailure = Error & {
  type?: string;
  code?: string;
  requestId?: string;
  raw?: { code?: string; message?: string; requestId?: string; type?: string };
};

function stripeErrorResponse(error: unknown) {
  if (!(error instanceof Error)) return null;
  const failure = error as StripeFailure;
  if (!failure.type?.startsWith("Stripe") && !failure.raw?.type?.startsWith("invalid_request")) return null;

  const providerMessage = failure.raw?.message || failure.message;
  const code = failure.code || failure.raw?.code || "stripe_request_failed";
  const requestId = failure.requestId || failure.raw?.requestId || "";
  const normalized = providerMessage.toLowerCase();
  const userMessage = normalized.includes("not activated") || normalized.includes("payment method type provided: pix is invalid")
    ? "O Pix ainda não está ativado na conta Stripe usada pelo CRM. Ative o Pix nas formas de pagamento do sandbox e tente novamente."
    : normalized.includes("email")
      ? "A Stripe recusou o e-mail financeiro cadastrado. Use um e-mail válido e tente novamente."
      : normalized.includes("mandate") || normalized.includes("pix")
        ? `A Stripe recusou a configuração do Pix Automático no sandbox: ${providerMessage}`
        : "A Stripe não conseguiu criar a autorização agora. Consulte o diagnóstico registrado nos logs do CRM.";

  console.error(JSON.stringify({
    level: "error",
    message: "Stripe checkout creation failed",
    route: "/api/billing/checkout",
    stripeType: failure.type || failure.raw?.type || "unknown",
    stripeCode: code,
    stripeRequestId: requestId,
    providerMessage,
  }));

  return Response.json({ error: userMessage, diagnosticCode: code }, { status: 502 });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    if (session.role !== "CEO_ADMIN") throw new HttpError(403, "Somente o administrador da empresa pode ativar a cobrança.");
    if (session.isSaasMaster) throw new HttpError(400, "A conta Mestre da DOCTYPE não possui assinatura comercial.");

    const billing = await db
      .selectFrom("organizations as o")
      .innerJoin("saas_accounts as sa", "sa.org_id", "o.id")
      .innerJoin("saas_billing as sb", "sb.org_id", "o.id")
      .select(["o.name", "sa.plan", "sb.monthly_price", "sb.billing_cycle", "sb.billing_email", "sb.external_customer_id", "sb.external_subscription_id"])
      .where("o.id", "=", session.orgId)
      .executeTakeFirst();

    if (!billing) throw new HttpError(404, "Assinatura não encontrada.");
    if (billing.external_subscription_id) throw new HttpError(409, "O Pix Automático já está ativo para esta empresa.");
    if (Number(billing.monthly_price) <= 0) throw new HttpError(400, "A DOCTYPE precisa definir o valor da assinatura antes da ativação.");

    let stripe;
    try { stripe = getStripe(); }
    catch { throw new HttpError(503, "A Stripe ainda não está configurada neste ambiente."); }

    const cycle = stripeCycle(billing.billing_cycle);
    const unitAmount = Math.round(Number(billing.monthly_price) * cycle.multiplier * 100);
    const metadata = { orgId: session.orgId, doctypePlan: billing.plan };
    let customerId = billing.external_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: billing.name,
        email: billing.billing_email || session.email,
        metadata,
      });
      customerId = customer.id;
      await db.updateTable("saas_billing").set({ external_customer_id: customerId, updated_at: new Date().toISOString() }).where("org_id", "=", session.orgId).execute();
    }

    const origin = new URL(request.url).origin;
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: session.orgId,
      locale: "pt-BR",
      payment_method_types: ["pix"],
      payment_method_options: {
        pix: {
          mandate_options: {
            amount: unitAmount,
            amount_type: "fixed",
            currency: "brl",
            payment_schedule: cycle.schedule,
            reference: `DOCTYPE ${billing.plan}`.slice(0, 80),
          },
        },
      },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "brl",
          unit_amount: unitAmount,
          product_data: { name: `DOCTYPE OS — Plano ${billing.plan}` },
          recurring: { interval: cycle.interval, interval_count: cycle.intervalCount },
        },
      }],
      metadata,
      subscription_data: { metadata },
      success_url: `${origin}/os?billing=success`,
      cancel_url: `${origin}/os?billing=cancelled`,
    });

    if (!checkout.url) throw new HttpError(502, "A Stripe não retornou a página segura de autorização.");
    await audit(session.orgId, session.id, "STRIPE_CHECKOUT_CREATED", "saas_billing", session.orgId, { checkoutSessionId: checkout.id, testMode: stripeIsTestMode() });
    return Response.json({ url: checkout.url });
  } catch (error) {
    return stripeErrorResponse(error) || apiError(error);
  }
}
