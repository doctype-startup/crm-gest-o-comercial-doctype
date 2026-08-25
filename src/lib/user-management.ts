import { sql } from "kysely";
import { hashPassword, revokeUserSessions, rotateUserSessions } from "./auth";
import { db, ensureSchema } from "./db";
import { HttpError } from "./http";
import type { Role, SessionUser } from "./types";

export type ManagedUserUpdate = {
  name: string;
  role: Role;
  active: boolean;
  password?: string;
};

export async function updateManagedUser(session: SessionUser, id: string, input: ManagedUserUpdate) {
  if (session.role !== "CEO_ADMIN") throw new HttpError(403, "Somente o administrador pode gerenciar usuários.");
  await ensureSchema();
  const passwordHash = input.password ? await hashPassword(input.password) : undefined;

  return db.transaction().execute(async (trx) => {
    // Serializa alterações administrativas da mesma empresa, inclusive quando
    // dois administradores tentam mudar permissões ao mesmo tempo.
    await sql`update organizations set name = name where id = ${session.orgId}`.execute(trx);
    const target = await trx
      .selectFrom("users")
      .select(["id", "role", "active"])
      .where("id", "=", id)
      .where("org_id", "=", session.orgId)
      .executeTakeFirst();
    if (!target) throw new HttpError(404, "Usuário não encontrado.");

    if (id === session.id && (!input.active || input.role !== "CEO_ADMIN")) {
      throw new HttpError(400, "Você não pode desativar ou remover a própria permissão de administrador.");
    }

    const removesActiveAdmin = Boolean(target.active) && target.role === "CEO_ADMIN" && (!input.active || input.role !== "CEO_ADMIN");
    if (removesActiveAdmin) {
      const count = await trx
        .selectFrom("users")
        .select(({ fn }) => fn.count<number>("id").as("count"))
        .where("org_id", "=", session.orgId)
        .where("role", "=", "CEO_ADMIN")
        .where("active", "=", 1)
        .executeTakeFirstOrThrow();
      if (Number(count.count) <= 1) throw new HttpError(409, "A empresa precisa manter pelo menos um CEO / Admin ativo.");
    }

    const values: {
      name: string;
      role: Role;
      active: number;
      updated_at: string;
      password_hash?: string;
      must_change_password?: number;
    } = {
      name: input.name,
      role: input.role,
      active: input.active ? 1 : 0,
      updated_at: new Date().toISOString(),
    };
    if (passwordHash) {
      values.password_hash = passwordHash;
      values.must_change_password = 1;
    }

    await trx.updateTable("users").set(values).where("id", "=", id).where("org_id", "=", session.orgId).execute();

    if (passwordHash && id === session.id) {
      return { session: await rotateUserSessions(id, trx) };
    }
    if (passwordHash || !input.active) await revokeUserSessions(id, trx);
    return { session: null };
  });
}
