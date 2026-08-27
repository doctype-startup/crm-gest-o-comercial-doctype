import { createHash } from "node:crypto";
import { db } from "./db";
import { canRead } from "./modules";
import { buildAlerts } from "./monitor";
import { listRecords } from "./records";
import { getRawState, setRawState } from "./state-cache";
import type { SessionUser } from "./types";

async function loadRawState(orgId: string) {
  const cached = getRawState(orgId);
  if (cached) return cached;
  const [all, settingsRows] = await Promise.all([
    listRecords(orgId),
    db.selectFrom("settings").select(["key", "value"]).where("org_id", "=", orgId).execute(),
  ]);
  const settings = Object.fromEntries(settingsRows.map((item) => [item.key, JSON.parse(item.value)]));
  setRawState(orgId, all, settings);
  return { records: all, settings, expiresAt: 0 };
}

export async function getAppState(user: SessionUser, ifNoneMatch?: string) {
  const raw = await loadRawState(user.orgId);
  const records = raw.records.filter((record) => canRead(user.role, record.module));
  const signature = records.map((record) => `${record.id}:${record.updatedAt}`).sort().join("|");
  // Alertas (buildAlerts / monitor-engine) mudam com a simples passagem do dia (D-7,
  // vencido, etc.) mesmo sem nenhum registro ser alterado — ver PROJECT_HANDOFF.md,
  // princípio 16. O dia UTC corrente entra no ETag exatamente para isso: garante que a
  // virada do dia sempre produz um ETag novo (200 com alerts recalculados), nunca um
  // 304 preso no snapshot do dia anterior.
  const today = new Date().toISOString().slice(0, 10);
  const etag = `"${createHash("sha1").update(`${user.role}|${today}|${signature}|${JSON.stringify(raw.settings)}`).digest("hex")}"`;

  if (ifNoneMatch && ifNoneMatch === etag) {
    return { notModified: true as const, etag };
  }

  const alerts = buildAlerts(records);
  return {
    notModified: false as const,
    etag,
    body: { records, alerts, settings: raw.settings, user, generatedAt: new Date().toISOString() },
  };
}
