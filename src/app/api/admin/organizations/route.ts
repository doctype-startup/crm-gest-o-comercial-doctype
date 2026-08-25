import { randomUUID } from "node:crypto";
import { requireSession, hashPassword } from "@/lib/auth";
import { audit, db } from "@/lib/db";
import { assertSameOrigin, apiError, HttpError } from "@/lib/http";
import { createSaasAccountSchema } from "@/lib/saas";

function requireMaster(session: Awaited<ReturnType<typeof requireSession>>) {
  if (!session.isSaasMaster || session.role !== "CEO_ADMIN") throw new HttpError(403, "Acesso exclusivo do Admin SaaS Mestre.");
}

export async function GET() {
  try {
    const session = await requireSession();
    requireMaster(session);
    const rows = await db
      .selectFrom("saas_accounts as sa")
      .innerJoin("organizations as o", "o.id", "sa.org_id")
      .leftJoin("saas_billing as sb", "sb.org_id", "sa.org_id")
      .select(["o.id", "o.name", "sa.slug", "sa.logo_data_url", "sa.plan", "sa.status", "sa.max_users", "sa.renewal_date", "sa.notes", "sa.created_at", "sa.updated_at", "sb.monthly_price", "sb.billing_cycle", "sb.billing_day", "sb.billing_email", "sb.payment_method", "sb.payment_status", "sb.next_charge_date", "sb.grace_until"])
      .orderBy("o.name")
      .execute();
    const organizations = await Promise.all(rows.map(async (row) => {
      const [users, activeUsers, records, admin] = await Promise.all([
        db.selectFrom("users").select(({ fn }) => fn.count<number>("id").as("count")).where("org_id", "=", row.id).executeTakeFirstOrThrow(),
        db.selectFrom("users").select(({ fn }) => fn.count<number>("id").as("count")).where("org_id", "=", row.id).where("active", "=", 1).executeTakeFirstOrThrow(),
        db.selectFrom("records").select(({ fn }) => fn.count<number>("id").as("count")).where("org_id", "=", row.id).executeTakeFirstOrThrow(),
        db.selectFrom("users").select(["name", "email"]).where("org_id", "=", row.id).where("role", "=", "CEO_ADMIN").orderBy("created_at").executeTakeFirst(),
      ]);
      return {
        id: row.id, name: row.name, slug: row.slug, logoDataUrl: row.logo_data_url, plan: row.plan, status: row.status,
        maxUsers: row.max_users, renewalDate: row.renewal_date, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at,
        userCount: Number(users.count), activeUserCount: Number(activeUsers.count), recordCount: Number(records.count),
        adminName: admin?.name || "", adminEmail: admin?.email || "",
        monthlyPrice: Number(row.monthly_price || 0), billingCycle: row.billing_cycle || "Mensal", billingDay: Number(row.billing_day || 10),
        billingEmail: row.billing_email || admin?.email || "", paymentMethod: row.payment_method || "Pix", paymentStatus: row.payment_status || "Pendente",
        nextChargeDate: row.next_charge_date || "", graceUntil: row.grace_until || "",
      };
    }));
    return Response.json({ organizations });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    requireMaster(session);
    const body = createSaasAccountSchema.parse(await request.json());
    const [duplicateSlug, duplicateEmail] = await Promise.all([
      db.selectFrom("saas_accounts").select("org_id").where("slug", "=", body.slug).executeTakeFirst(),
      db.selectFrom("users").select("id").where("email", "=", body.adminEmail.toLowerCase()).executeTakeFirst(),
    ]);
    if (duplicateSlug) throw new HttpError(409, "Este identificador de empresa já está em uso.");
    if (duplicateEmail) throw new HttpError(409, "Já existe um usuário com este e-mail.");
    const now = new Date().toISOString();
    const orgId = randomUUID();
    const adminId = randomUUID();
    const passwordHash = await hashPassword(body.temporaryPassword);
    await db.transaction().execute(async (trx) => {
      await trx.insertInto("organizations").values({ id: orgId, name: body.name, created_at: now }).execute();
      await trx.insertInto("saas_accounts").values({ org_id: orgId, slug: body.slug, logo_data_url: body.logoDataUrl, plan: body.plan, status: body.status, max_users: body.maxUsers, renewal_date: body.renewalDate, notes: body.notes, created_at: now, updated_at: now }).execute();
      await trx.insertInto("users").values({ id: adminId, org_id: orgId, name: body.adminName, email: body.adminEmail.toLowerCase(), password_hash: passwordHash, role: "CEO_ADMIN", active: 1, must_change_password: 1, created_at: now, updated_at: now }).execute();
      await trx.insertInto("saas_billing").values({ org_id: orgId, monthly_price: body.monthlyPrice, billing_cycle: body.billingCycle, billing_day: body.billingDay, billing_email: (body.billingEmail || body.adminEmail).toLowerCase(), payment_method: body.paymentMethod, payment_status: body.paymentStatus, next_charge_date: body.nextChargeDate, grace_until: body.graceUntil, external_customer_id: "", external_subscription_id: "", updated_at: now }).execute();
      await trx.insertInto("settings").values({ org_id: orgId, key: "crmGoal", value: "3000", updated_at: now }).execute();
    });
    await audit(session.orgId, session.id, "CREATE", "saas_organization", orgId, { name: body.name, slug: body.slug, plan: body.plan, status: body.status, adminEmail: body.adminEmail.toLowerCase(), monthlyPrice: body.monthlyPrice, paymentStatus: body.paymentStatus });
    return Response.json({ organization: { id: orgId } }, { status: 201 });
  } catch (error) { return apiError(error); }
}
