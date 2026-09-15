import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, assertSameOrigin, HttpError } from "@/lib/http";
import { canWrite } from "@/lib/modules";
import { getStripe, stripeIsTestMode } from "@/lib/stripe";
import { AUTOMATED_PAYMENT_METHOD_TYPES } from "@/lib/stripe-billing";
import { invalidateState } from "@/lib/state-cache";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSession();
    if (!canWrite(user.role, "invoices")) throw new HttpError(403, "Você não pode gerar cobranças.");
    const { id } = await params;

    const row = await db.selectFrom("records").selectAll().where("id", "=", id).where("org_id", "=", user.orgId).where("module", "=", "invoices").executeTakeFirst();
    if (!row) throw new HttpError(404, "Fatura não encontrada.");
    const data = JSON.parse(row.data) as Record<string, unknown>;
    if (data.status === "Pago") throw new HttpError(409, "Esta fatura já está paga.");
    if (data.status === "Cancelado") throw new HttpError(409, "Não é possível cobrar uma fatura cancelada.");
    const value = Number(data.value || 0);
    if (value <= 0) throw new HttpError(400, "Defina um valor para a fatura antes de gerar a cobrança.");

    const clientRow = data.clientId
      ? await db.selectFrom("records").select(["data"]).where("id", "=", String(data.clientId)).where("org_id", "=", user.orgId).where("module", "=", "clients").executeTakeFirst()
      : undefined;
    const clientData = clientRow ? (JSON.parse(clientRow.data) as Record<string, unknown>) : {};
    const clientEmail = typeof clientData.contactEmail === "string" ? clientData.contactEmail : "";
    const clientName = typeof clientData.name === "string" && clientData.name ? clientData.name : "Cliente";

    let stripe;
    try { stripe = getStripe(); }
    catch { throw new HttpError(503, "A Stripe ainda não está configurada neste ambiente."); }

    const origin = new URL(request.url).origin;
    // Mesma lógica do checkout de assinatura SaaS (/api/billing/checkout): uma
    // Configuração de método de pagamento nomeada, quando definida, é a fonte
    // única da verdade — não pode ser combinada com payment_method_types.
    const paymentMethodConfiguration = process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION;
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "pt-BR",
      ...(clientEmail ? { customer_email: clientEmail } : {}),
      ...(paymentMethodConfiguration
        ? { payment_method_configuration: paymentMethodConfiguration }
        : { payment_method_types: [...AUTOMATED_PAYMENT_METHOD_TYPES] }),
      payment_method_options: { boleto: { expires_after_days: 3 } },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "brl",
          unit_amount: Math.round(value * 100),
          product_data: { name: String(data.description || "Fatura"), description: `Cliente: ${clientName}` },
        },
      }],
      metadata: { kind: "client_invoice", orgId: user.orgId, recordId: id },
      success_url: `${origin}/os?invoice=paid`,
      cancel_url: `${origin}/os?invoice=cancelled`,
    });

    if (!checkout.url) throw new HttpError(502, "A Stripe não retornou o link de cobrança.");

    const now = new Date().toISOString();
    const nextData = { ...data, paymentLink: checkout.url, paymentLinkStatus: "Pendente", stripeCheckoutSessionId: checkout.id };
    await db.updateTable("records").set({ data: JSON.stringify(nextData), updated_at: now }).where("id", "=", id).where("org_id", "=", user.orgId).execute();
    invalidateState(user.orgId);

    return Response.json({ url: checkout.url, testMode: stripeIsTestMode() });
  } catch (error) { return apiError(error); }
}
