import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, HttpError } from "@/lib/http";
import { stripeIsConfigured, stripeIsTestMode } from "@/lib/stripe";

export async function GET() {
  try {
    const session = await requireSession();
    if (session.role !== "CEO_ADMIN") throw new HttpError(403, "A assinatura está disponível somente para o administrador da empresa.");
    const row = await db
      .selectFrom("organizations as o")
      .leftJoin("saas_accounts as sa", "sa.org_id", "o.id")
      .leftJoin("saas_billing as sb", "sb.org_id", "o.id")
      .select(["o.name", "sa.plan", "sa.status", "sa.max_users", "sa.renewal_date", "sb.monthly_price", "sb.billing_cycle", "sb.billing_day", "sb.billing_email", "sb.payment_method", "sb.payment_status", "sb.next_charge_date", "sb.grace_until", "sb.external_subscription_id"])
      .where("o.id", "=", session.orgId)
      .executeTakeFirst();
    if (!row) throw new HttpError(404, "Assinatura não encontrada.");
    return Response.json({
      subscription: {
        organizationName: row.name,
        plan: row.plan || "Interno",
        accountStatus: row.status || "Ativo",
        maxUsers: Number(row.max_users || 0),
        renewalDate: row.renewal_date || "",
        monthlyPrice: Number(row.monthly_price || 0),
        billingCycle: row.billing_cycle || "Mensal",
        billingDay: Number(row.billing_day || 10),
        billingEmail: row.billing_email || session.email,
        paymentMethod: row.payment_method || "Não configurado",
        paymentStatus: row.payment_status || (session.isSaasMaster ? "Isento" : "Pendente"),
        nextChargeDate: row.next_charge_date || "",
        graceUntil: row.grace_until || "",
        automaticBilling: Boolean(row.external_subscription_id),
        stripeConfigured: stripeIsConfigured(),
        testMode: stripeIsTestMode(),
      },
    });
  } catch (error) { return apiError(error); }
}
