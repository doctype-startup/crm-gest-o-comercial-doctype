import { randomUUID } from "node:crypto";
import { db, audit } from "./db";
import { moduleSchemas } from "./modules";
import type { AppRecord, ModuleKey, SessionUser } from "./types";

export function decodeRecord(row: { id: string; module: string; data: string; created_at: string; updated_at: string }): AppRecord {
  return {
    id: row.id,
    module: row.module as ModuleKey,
    data: JSON.parse(row.data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listRecords(orgId: string, module?: ModuleKey) {
  let query = db.selectFrom("records").select(["id", "module", "data", "created_at", "updated_at"]).where("org_id", "=", orgId);
  if (module) query = query.where("module", "=", module);
  const rows = await query.orderBy("updated_at", "desc").execute();
  return rows.map(decodeRecord);
}

export async function createRecord(user: SessionUser, module: ModuleKey, input: unknown) {
  const data = moduleSchemas[module].parse(input);
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.insertInto("records").values({
    id,
    org_id: user.orgId,
    module,
    data: JSON.stringify(data),
    created_by: user.id,
    created_at: now,
    updated_at: now,
  }).execute();
  await audit(user.orgId, user.id, "CREATE", module, id, { fields: Object.keys(data) });
  return { id, module, data, createdAt: now, updatedAt: now } satisfies AppRecord;
}

export async function updateRecord(user: SessionUser, id: string, module: ModuleKey, input: unknown) {
  const current = await db.selectFrom("records").selectAll().where("id", "=", id).where("org_id", "=", user.orgId).where("module", "=", module).executeTakeFirst();
  if (!current) return null;
  const data = moduleSchemas[module].parse(input);
  const now = new Date().toISOString();
  await db.updateTable("records").set({ data: JSON.stringify(data), updated_at: now }).where("id", "=", id).where("org_id", "=", user.orgId).execute();
  await audit(user.orgId, user.id, "UPDATE", module, id, { fields: Object.keys(data) });
  return { id, module, data, createdAt: current.created_at, updatedAt: now } satisfies AppRecord;
}

export async function deleteRecord(user: SessionUser, id: string, module: ModuleKey) {
  let cascaded = 0;
  const deleted = await db.transaction().execute(async (trx) => {
    if (module === "clients") {
      const related = await trx.selectFrom("records").select(["id", "data"]).where("org_id", "=", user.orgId).where("module", "in", ["accesses", "invoices", "tasks", "crm", "quotes", "contracts"]).execute();
      const ids = related.filter((row) => JSON.parse(row.data).clientId === id).map((row) => row.id);
      if (ids.length) { await trx.deleteFrom("records").where("id", "in", ids).execute(); cascaded = ids.length; }
    }
    const result = await trx.deleteFrom("records").where("id", "=", id).where("org_id", "=", user.orgId).where("module", "=", module).executeTakeFirst();
    return Number(result.numDeletedRows) > 0;
  });
  if (deleted) await audit(user.orgId, user.id, "DELETE", module, id, { cascaded });
  return deleted;
}
