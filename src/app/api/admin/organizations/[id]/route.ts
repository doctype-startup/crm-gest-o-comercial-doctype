import { requireSession } from "@/lib/auth";
import { audit, db } from "@/lib/db";
import { assertSameOrigin, apiError, HttpError } from "@/lib/http";
import { updateSaasAccountSchema } from "@/lib/saas";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    if (!session.isSaasMaster || session.role !== "CEO_ADMIN") throw new HttpError(403, "Acesso exclusivo do Admin SaaS Mestre.");
    const id = (await params).id;
    const body = updateSaasAccountSchema.parse(await request.json());
    const [current, duplicateSlug] = await Promise.all([
      db.selectFrom("saas_accounts").select(["org_id", "status"]).where("org_id", "=", id).executeTakeFirst(),
      db.selectFrom("saas_accounts").select("org_id").where("slug", "=", body.slug).where("org_id", "!=", id).executeTakeFirst(),
    ]);
    if (!current) throw new HttpError(404, "Empresa SaaS não encontrada.");
    if (duplicateSlug) throw new HttpError(409, "Este identificador de empresa já está em uso.");
    const now = new Date().toISOString();
    await db.transaction().execute(async (trx) => {
      await trx.updateTable("organizations").set({ name: body.name }).where("id", "=", id).execute();
      await trx.updateTable("saas_accounts").set({ slug: body.slug, logo_data_url: body.logoDataUrl, plan: body.plan, status: body.status, max_users: body.maxUsers, renewal_date: body.renewalDate, notes: body.notes, updated_at: now }).where("org_id", "=", id).execute();
      await trx.insertInto("saas_billing").values({ org_id: id, monthly_price: body.monthlyPrice, billing_cycle: body.billingCycle, billing_day: body.billingDay, billing_email: body.billingEmail.toLowerCase(), payment_method: body.paymentMethod, payment_status: body.paymentStatus, next_charge_date: body.nextChargeDate, grace_until: body.graceUntil, external_customer_id: "", external_subscription_id: "", updated_at: now }).onConflict((conflict) => conflict.column("org_id").doUpdateSet({ monthly_price: body.monthlyPrice, billing_cycle: body.billingCycle, billing_day: body.billingDay, billing_email: body.billingEmail.toLowerCase(), payment_method: body.paymentMethod, payment_status: body.paymentStatus, next_charge_date: body.nextChargeDate, grace_until: body.graceUntil, updated_at: now })).execute();
      if (body.status === "Suspenso" || body.status === "Cancelado") {
        const users = await trx.selectFrom("users").select("id").where("org_id", "=", id).execute();
        if (users.length) await trx.deleteFrom("sessions").where("user_id", "in", users.map((user) => user.id)).execute();
      }
    });
    await audit(session.orgId, session.id, "UPDATE", "saas_organization", id, { name: body.name, plan: body.plan, previousStatus: current.status, status: body.status, monthlyPrice: body.monthlyPrice, paymentStatus: body.paymentStatus });
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
