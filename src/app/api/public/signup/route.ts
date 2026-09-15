import { randomUUID } from "node:crypto";
import { z } from "zod";
import { passwordSchema, registerSignupAttempt, signupThrottleIdentifiers, loginThrottleStatus } from "@/lib/account-security";
import { authenticate, hashPassword, setSessionCookie } from "@/lib/auth";
import { audit, db, ensureSchema } from "@/lib/db";
import { apiError, assertSameOrigin, HttpError } from "@/lib/http";
import { planCatalogEntry } from "@/lib/plan-catalog";
import { slugify } from "@/lib/saas";

export const runtime = "nodejs";

const publicSignupSchema = z.object({
  companyName: z.string().trim().min(2, "Informe o nome da empresa.").max(200),
  adminName: z.string().trim().min(2, "Informe seu nome.").max(200),
  adminEmail: z.string().trim().email("E-mail inválido.").max(200),
  password: passwordSchema,
  plan: z.enum(["Start", "Smart", "Pro"]),
});

async function uniqueSlug(companyName: string) {
  const base = slugify(companyName) || "empresa";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${randomUUID().slice(0, 6)}`;
    const taken = await db.selectFrom("saas_accounts").select("org_id").where("slug", "=", candidate).executeTakeFirst();
    if (!taken) return candidate;
  }
  throw new HttpError(500, "Não foi possível gerar um identificador único para a empresa. Tente novamente.");
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await ensureSchema();

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const identifiers = signupThrottleIdentifiers(ip);
    const throttle = await loginThrottleStatus(identifiers);
    if (throttle.blocked) {
      return Response.json(
        { error: "Muitos cadastros a partir deste endereço. Aguarde alguns minutos e tente novamente." },
        { status: 429, headers: { "Retry-After": String(throttle.retryAfterSeconds) } },
      );
    }

    const body = publicSignupSchema.parse(await request.json());
    const plan = planCatalogEntry(body.plan);
    if (!plan) throw new HttpError(400, "Plano inválido.");

    const duplicateEmail = await db.selectFrom("users").select("id").where("email", "=", body.adminEmail.toLowerCase()).executeTakeFirst();
    if (duplicateEmail) {
      await registerSignupAttempt(identifiers);
      throw new HttpError(409, "Já existe uma conta com este e-mail.");
    }

    const slug = await uniqueSlug(body.companyName);
    const now = new Date().toISOString();
    const orgId = randomUUID();
    const adminId = randomUUID();
    const passwordHash = await hashPassword(body.password);

    await db.transaction().execute(async (trx) => {
      await trx.insertInto("organizations").values({ id: orgId, name: body.companyName, created_at: now }).execute();
      await trx.insertInto("saas_accounts").values({
        org_id: orgId, slug, logo_data_url: "", plan: plan.id, status: "Teste", max_users: plan.maxUsers,
        renewal_date: "", notes: "Cadastro self-service.", is_test_client: 0, created_at: now, updated_at: now,
      }).execute();
      await trx.insertInto("users").values({
        id: adminId, org_id: orgId, name: body.adminName, email: body.adminEmail.toLowerCase(), password_hash: passwordHash,
        role: "CEO_ADMIN", active: 1, must_change_password: 0, created_at: now, updated_at: now,
      }).execute();
      await trx.insertInto("saas_billing").values({
        org_id: orgId, monthly_price: plan.monthlyPrice, billing_cycle: "Mensal", billing_day: 10,
        billing_email: body.adminEmail.toLowerCase(), payment_method: "Pix", payment_status: "Pendente",
        next_charge_date: "", grace_until: "", external_customer_id: "", external_subscription_id: "", updated_at: now,
      }).execute();
      await trx.insertInto("settings").values({ org_id: orgId, key: "crmGoal", value: "3000", updated_at: now }).execute();
    });

    await audit(orgId, adminId, "CREATE", "saas_organization", orgId, {
      name: body.companyName, slug, plan: plan.id, source: "self_service_signup",
    });
    await registerSignupAttempt(identifiers);

    const session = await authenticate(body.adminEmail, body.password);
    if (!session) throw new HttpError(500, "Empresa criada, mas não foi possível iniciar sua sessão automaticamente. Faça login manualmente.");
    await setSessionCookie(session.token, session.expires);

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) { return apiError(error); }
}
