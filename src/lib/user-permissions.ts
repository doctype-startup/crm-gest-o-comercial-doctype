import type { Kysely, Transaction } from "kysely";
import { isModule } from "./modules";
import { HttpError } from "./http";
import type { Database, RecordModuleKey } from "./types";

export type PermissionsInput = Partial<Record<string, { read?: boolean; write?: boolean }>>;

type Executor = Kysely<Database> | Transaction<Database>;

/**
 * Substitui todas as exceções por módulo deste usuário pelas informadas em `input`
 * (a tela de permissões sempre envia a matriz completa). `input` ausente = não mexe
 * nas permissões existentes; presente = passa a ser a verdade inteira para este usuário.
 */
export async function saveUserModulePermissions(executor: Executor, orgId: string, userId: string, input: PermissionsInput | undefined) {
  if (!input) return;
  const now = new Date().toISOString();
  const rows = Object.entries(input)
    .filter((entry): entry is [RecordModuleKey, { read?: boolean; write?: boolean }] => isModule(entry[0]) && Boolean(entry[1]))
    .map(([module, value]) => {
      const read = Boolean(value.read);
      const write = Boolean(value.write);
      if (write && !read) throw new HttpError(400, "Não é possível liberar edição sem liberar visualização.");
      return { org_id: orgId, user_id: userId, module, can_read: read ? 1 : 0, can_write: write ? 1 : 0, updated_at: now };
    });

  await executor.deleteFrom("user_module_permissions").where("user_id", "=", userId).execute();
  if (rows.length) await executor.insertInto("user_module_permissions").values(rows).execute();
}
