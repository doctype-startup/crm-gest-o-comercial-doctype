import { randomUUID } from "node:crypto";
import { db, audit } from "./db";
import { externalizeDataUrl } from "./blob-storage";
import { moduleSchemas } from "./modules";
import { invalidateState } from "./state-cache";
import type { AppRecord, RecordModuleKey, SessionUser } from "./types";
import { HttpError } from "./http";

export function decodeRecord(row: { id: string; module: string; data: string; created_at: string; updated_at: string }): AppRecord {
  return { id: row.id, module: row.module as RecordModuleKey, data: JSON.parse(row.data), createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function listRecords(orgId: string, module?: RecordModuleKey) {
  let query = db.selectFrom("records").select(["id", "module", "data", "created_at", "updated_at"]).where("org_id", "=", orgId);
  if (module) query = query.where("module", "=", module);
  const rows = await query.orderBy("updated_at", "desc").execute();
  return rows.map(decodeRecord);
}

// Contratos e logos chegam como data URL base64 dentro do próprio payload do módulo.
// Quando o Vercel Blob está configurado (ver src/lib/blob-storage.ts), arquivos acima
// do limiar saem da tabela `records` e viram só uma URL — sem isso, nada muda.
async function externalizeFiles(orgId: string, module: RecordModuleKey, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (module === "clients") {
    const next = { ...data };
    next.logoDataUrl = await externalizeDataUrl(next.logoDataUrl, `org/${orgId}/clients/logo`);
    const file = next.contractFile as { name?: string; dataUrl?: string } | undefined;
    if (file && typeof file === "object") {
      next.contractFile = { ...file, dataUrl: await externalizeDataUrl(file.dataUrl, `org/${orgId}/clients/contract`) };
    }
    return next;
  }
  if (module === "contracts") {
    const next = { ...data };
    next.fileDataUrl = await externalizeDataUrl(next.fileDataUrl, `org/${orgId}/contracts/file`);
    return next;
  }
  return data;
}

export async function createRecord(user: SessionUser, module: RecordModuleKey, input: unknown) {
  const parsed = moduleSchemas[module].parse(input);
  const data = await externalizeFiles(user.orgId, module, parsed);
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.insertInto("records").values({ id, org_id: user.orgId, module, data: JSON.stringify(data), created_by: user.id, created_at: now, updated_at: now }).execute();
  await audit(user.orgId, user.id, "CREATE", module, id, { fields: Object.keys(data) });
  invalidateState(user.orgId);
  return { id, module, data, createdAt: now, updatedAt: now } satisfies AppRecord;
}

// expectedUpdatedAt implementa controle de concorrência otimista: quando o cliente
// envia o `updatedAt` que ele tinha em tela e ele não bate mais com o do banco,
// alguém alterou o registro entretanto — recusamos a gravação em vez de sobrescrever
// silenciosamente (o que antes acontecia sempre, "último a salvar vence").
// Chamadas que não enviam expectedUpdatedAt (ex.: integrações antigas) mantêm o
// comportamento anterior.
export async function updateRecord(user: SessionUser, id: string, module: RecordModuleKey, input: unknown, expectedUpdatedAt?: string) {
  const current = await db.selectFrom("records").selectAll().where("id", "=", id).where("org_id", "=", user.orgId).where("module", "=", module).executeTakeFirst();
  if (!current) return null;
  if (expectedUpdatedAt && expectedUpdatedAt !== current.updated_at) {
    throw new HttpError(409, "Este registro foi alterado por outra pessoa. Recarregue e tente novamente.");
  }
  const parsed = moduleSchemas[module].parse(input);
  const data = await externalizeFiles(user.orgId, module, parsed);
  const now = new Date().toISOString();
  await db.updateTable("records").set({ data: JSON.stringify(data), updated_at: now }).where("id", "=", id).where("org_id", "=", user.orgId).execute();
  await audit(user.orgId, user.id, "UPDATE", module, id, { fields: Object.keys(data) });
  invalidateState(user.orgId);
  return { id, module, data, createdAt: current.created_at, updatedAt: now } satisfies AppRecord;
}

export async function deleteRecord(user: SessionUser, id: string, module: RecordModuleKey) {
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
  if (deleted) {
    await audit(user.orgId, user.id, "DELETE", module, id, { cascaded });
    invalidateState(user.orgId);
  }
  return deleted;
}
