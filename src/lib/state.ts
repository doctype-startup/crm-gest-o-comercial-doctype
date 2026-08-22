import { db } from "./db";
import { canRead } from "./modules";
import { buildAlerts } from "./monitor";
import { listRecords } from "./records";
import type { ModuleKey, SessionUser } from "./types";

export async function getAppState(user: SessionUser) {
  const modules: ModuleKey[] = ["clients", "accesses", "invoices", "expenses", "tasks", "crm", "team", "products", "quotes", "contracts"];
  const allowed = modules.filter((moduleKey) => canRead(user.role, moduleKey));
  const [all, settingsRows] = await Promise.all([
    listRecords(user.orgId),
    db.selectFrom("settings").select(["key", "value"]).where("org_id", "=", user.orgId).execute(),
  ]);
  const records = all.filter((record) => allowed.includes(record.module));
  const settings = Object.fromEntries(settingsRows.map((item) => [item.key, JSON.parse(item.value)]));
  return { records, alerts: buildAlerts(records), settings, user, generatedAt: new Date().toISOString() };
}
