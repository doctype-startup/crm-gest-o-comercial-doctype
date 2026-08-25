import { hash, verify } from "@node-rs/argon2";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { db, ensureSchema, audit } from "./db";
import type { Role, SessionUser } from "./types";

const COOKIE_NAME = "doctype_os_session";
const SESSION_DAYS = 7;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  return hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function seedAdmin() {
  await ensureSchema();
  const existing = await db.selectFrom("users").select("id").limit(1).executeTakeFirst();
  if (existing) return;

  const isProd = process.env.NODE_ENV === "production";
  const email = process.env.SEED_ADMIN_EMAIL || (isProd ? "" : "admin@doctype.local");
  const password = process.env.SEED_ADMIN_PASSWORD || (isProd ? "" : "Doctype@2026");
  if (!email || !password) throw new Error("Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD para criar o primeiro administrador.");
  if (password.length < 10) throw new Error("SEED_ADMIN_PASSWORD deve ter pelo menos 10 caracteres.");

  const now = new Date().toISOString();
  const orgId = randomUUID();
  const userId = randomUUID();
  await db.transaction().execute(async (trx) => {
    await trx.insertInto("organizations").values({ id: orgId, name: "DOCTYPE", created_at: now }).execute();
    await trx.insertInto("users").values({
      id: userId,
      org_id: orgId,
      name: process.env.SEED_ADMIN_NAME || "Administrador DOCTYPE",
      email: email.toLowerCase(),
      password_hash: await hashPassword(password),
      role: "CEO_ADMIN",
      active: 1,
      must_change_password: 1,
      created_at: now,
      updated_at: now,
    }).execute();
    await trx.insertInto("platform_admins").values({ user_id: userId, created_at: now }).execute();
    await trx.insertInto("settings").values({ org_id: orgId, key: "crmGoal", value: "3000", updated_at: now }).execute();
  });
}

export async function authenticate(email: string, password: string) {
  await seedAdmin();
  const user = await db.selectFrom("users").selectAll().where("email", "=", email.toLowerCase()).executeTakeFirst();
  if (!user || !user.active || !(await verify(user.password_hash, password))) return null;
  const account = await db.selectFrom("saas_accounts").select("status").where("org_id", "=", user.org_id).executeTakeFirst();
  if (account?.status === "Suspenso" || account?.status === "Cancelado") return null;

  const rawToken = randomBytes(32).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);
  await db.insertInto("sessions").values({
    id: randomUUID(),
    user_id: user.id,
    token_hash: tokenHash(rawToken),
    expires_at: expires.toISOString(),
    created_at: now.toISOString(),
  }).execute();
  await audit(user.org_id, user.id, "LOGIN", "session", null);
  return { token: rawToken, expires };
}

export async function setSessionCookie(token: string, expires: Date) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  await seedAdmin();
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const row = await db
    .selectFrom("sessions as s")
    .innerJoin("users as u", "u.id", "s.user_id")
    .leftJoin("platform_admins as pa", "pa.user_id", "u.id")
    .leftJoin("saas_accounts as sa", "sa.org_id", "u.org_id")
    .select(["u.id", "u.org_id", "u.name", "u.email", "u.role", "u.active", "u.must_change_password", "s.expires_at", "pa.user_id as platform_admin_id", "sa.status as saas_status"])
    .where("s.token_hash", "=", tokenHash(token))
    .executeTakeFirst();
  if (!row || !row.active || row.expires_at < new Date().toISOString() || row.saas_status === "Suspenso" || row.saas_status === "Cancelado") return null;
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    mustChangePassword: Boolean(row.must_change_password),
    isSaasMaster: Boolean(row.platform_admin_id),
  };
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new AuthError();
  return session;
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) await db.deleteFrom("sessions").where("token_hash", "=", tokenHash(token)).execute();
  jar.delete(COOKIE_NAME);
}

export class AuthError extends Error {
  status = 401;
  constructor() { super("Sessão inválida ou expirada."); }
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) return Response.json({ error: error.message }, { status: 401 });
  console.error(error);
  return Response.json({ error: "Não foi possível concluir a operação." }, { status: 500 });
}
