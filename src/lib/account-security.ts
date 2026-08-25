import { createHash } from "node:crypto";
import { z } from "zod";
import { db, ensureSchema } from "./db";

const LOGIN_WINDOW_MS = 15 * 60_000;
const MAX_LOGIN_ATTEMPTS = 8;

export const passwordSchema = z
  .string()
  .min(10, "Use pelo menos 10 caracteres.")
  .max(200, "A senha é muito longa.")
  .regex(/[A-Za-zÀ-ÿ]/, "Inclua pelo menos uma letra.")
  .regex(/[0-9]/, "Inclua pelo menos um número.")
  .regex(/[^A-Za-zÀ-ÿ0-9]/, "Inclua pelo menos um símbolo.");

function keyHash(identifier: string) {
  return createHash("sha256").update(identifier).digest("hex");
}

export function loginThrottleIdentifiers(ip: string, email: string) {
  return [`ip:${ip}`, `account:${email.trim().toLowerCase()}`];
}

export async function loginThrottleStatus(identifiers: string[], now = new Date()) {
  await ensureSchema();
  const hashes = identifiers.map(keyHash);
  const rows = hashes.length
    ? await db.selectFrom("login_rate_limits").select(["locked_until"]).where("key_hash", "in", hashes).execute()
    : [];
  const latestLock = rows.reduce((latest, row) => row.locked_until > latest ? row.locked_until : latest, "");
  const retryAfterSeconds = latestLock > now.toISOString()
    ? Math.max(1, Math.ceil((new Date(latestLock).getTime() - now.getTime()) / 1000))
    : 0;
  return { blocked: retryAfterSeconds > 0, retryAfterSeconds };
}

export async function registerLoginFailure(identifiers: string[], now = new Date()) {
  await ensureSchema();
  const nowIso = now.toISOString();
  const windowCutoff = new Date(now.getTime() - LOGIN_WINDOW_MS).toISOString();
  const lockUntil = new Date(now.getTime() + LOGIN_WINDOW_MS).toISOString();

  await db.transaction().execute(async (trx) => {
    for (const identifier of identifiers) {
      const hash = keyHash(identifier);
      const existing = await trx.selectFrom("login_rate_limits").selectAll().where("key_hash", "=", hash).executeTakeFirst();
      const inCurrentWindow = Boolean(existing && existing.window_started_at > windowCutoff);
      const attempts = inCurrentWindow ? Number(existing?.attempts || 0) + 1 : 1;
      const values = {
        attempts,
        window_started_at: inCurrentWindow ? existing!.window_started_at : nowIso,
        locked_until: attempts >= MAX_LOGIN_ATTEMPTS ? lockUntil : (existing?.locked_until || ""),
        updated_at: nowIso,
      };
      if (existing) await trx.updateTable("login_rate_limits").set(values).where("key_hash", "=", hash).execute();
      else await trx.insertInto("login_rate_limits").values({ key_hash: hash, ...values }).execute();
    }
  });
}

export async function clearLoginFailures(identifiers: string[]) {
  await ensureSchema();
  const hashes = identifiers.map(keyHash);
  if (hashes.length) await db.deleteFrom("login_rate_limits").where("key_hash", "in", hashes).execute();
}
