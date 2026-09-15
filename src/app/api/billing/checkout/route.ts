import { requireSession } from "@/lib/auth";
import { audit, db } from "@/lib/db";
import { apiError, assertSameOrigin, HttpError } from "@/lib/http";
import { getStripe, stripeIsTestMode } from "@/lib/stripe";
import { AUTOMATED_PAYMENT_METHOD_TYPES, checkoutIdempotencyKey, stripeCycle } from "@/lib/stripe-billing";

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
  const inactiveMethod = normalized.includes("payment method type provided: pix is invalid") ? "Pix"
    : normalized.includes("payment method type provided: boleto is invalid") ? "Boleto"
      : normalized.includes("payment method type provided: card is invalid") ? "Cartão"
        : normalized.includes("not activated") ? "uma das formas de pagamento"
          : null;
  const userMessage = inactiveMethod
    ? `${inactiveMethod === "uma das formas de pagamento" ? "Uma das formas de pagamento" : inactiveMethod} ainda não está ativada na conta Stripe usada pelo CRM. Ative-a nas formas de pagamento do sandbox e tente novamente.`
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
    // Diagnóstico: confirma se STRIPE_PAYMENT_METHOD_CONFIGURATION realmente
    // chegou no runtime (não é segredo, é só um ID de configuração — seguro
    // logar por inteiro).
    paymentMethodConfigurationEnv: process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION || "(não definida)",
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
    // A Stripe recomenda não combinar payment_method_types explícito com uma
    // Configuração de método de pagamento nomeada do dashboard — o primeiro que
    // for enviado é o que manda. Quando STRIPE_PAYMENT_METHOD_CONFIGURATION está
    // definida, ela vira a fonte única da verdade (o que estiver ativo lá é o que
    // aparece no checkout); sem ela, cai de volta na lista fixa no código.
    const paymentMethodConfiguration = process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION;
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: session.orgId,
      locale: "pt-BR",
      ...(paymentMethodConfiguration
        ? { payment_method_configuration: paymentMethodConfiguration }
        : { payment_method_types: [...AUTOMATED_PAYMENT_METHOD_TYPES] }),
      payment_method_options: {
        pix: {
          // Em mode="subscription" a Stripe só aceita "amount" e "payment_schedule"
          // aqui — "currency" e "reference" são inferidos/gerados por ela e a API
          // rejeita com invalid_request_error se forem enviados explicitamente.
          mandate_options: {
            amount: unitAmount,
            payment_schedule: cycle.schedule,
          },
        },
        boleto: { expires_after_days: 3 },
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
      // Em mode="subscription" a Stripe já salva automaticamente o método usado
      // aqui (Pix, Cartão ou Boleto) como padrão para as próximas mensalidades.
      subscription_data: { metadata },
      success_url: `${origin}/os?billing=success`,
      cancel_url: `${origin}/os?billing=cancelled`,
    }, {
      idempotencyKey: checkoutIdempotencyKey({
        orgId: session.orgId,
        plan: billing.plan,
        monthlyPrice: Number(billing.monthly_price),
        billingCycle: billing.billing_cycle,
      }),
    });

    if (!checkout.url) throw new HttpError(502, "A Stripe não retornou a página segura de autorização.");
    await audit(session.orgId, session.id, "STRIPE_CHECKOUT_CREATED", "saas_billing", session.orgId, { checkoutSessionId: checkout.id, testMode: stripeIsTestMode() });
    return Response.json({ url: checkout.url });
  } catch (error) {
    return stripeErrorResponse(error) || apiError(error);
  }
}
