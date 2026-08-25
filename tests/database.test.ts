import { beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/types";

process.env.DATABASE_URL = `sqlite:/tmp/doctype-os-vitest-${process.pid}.db`;
process.env.DATABASE_ENGINE = "sqlite";
process.env.SEED_ADMIN_EMAIL = "admin-test@doctype.local";
process.env.SEED_ADMIN_PASSWORD = "Doctype@Teste2026";

let dbModule: typeof import("@/lib/db");
let recordsModule: typeof import("@/lib/records");
let authModule: typeof import("@/lib/auth");
let accountSecurityModule: typeof import("@/lib/account-security");
let userManagementModule: typeof import("@/lib/user-management");

beforeAll(async () => {
  dbModule = await import("@/lib/db");
  recordsModule = await import("@/lib/records");
  authModule = await import("@/lib/auth");
  accountSecurityModule = await import("@/lib/account-security");
  userManagementModule = await import("@/lib/user-management");
  await authModule.seedAdmin();
});

describe("persistência multiusuário", () => {
  it("marca o administrador inicial como Admin SaaS Mestre", async () => {
    const admin = await dbModule.db.selectFrom("users").select("id").where("email", "=", "admin-test@doctype.local").executeTakeFirstOrThrow();
    const platformAdmin = await dbModule.db.selectFrom("platform_admins").select("user_id").where("user_id", "=", admin.id).executeTakeFirst();
    expect(platformAdmin?.user_id).toBe(admin.id);
  });

  it("cria, edita e exclui registro com auditoria", async () => {
    const row = await dbModule.db.selectFrom("users").selectAll().where("email", "=", "admin-test@doctype.local").executeTakeFirstOrThrow();
    const user: SessionUser = { id: row.id, orgId: row.org_id, name: row.name, email: row.email, role: "CEO_ADMIN", mustChangePassword: true };
    const created = await recordsModule.createRecord(user, "clients", { name: "Cliente Teste", services: "CRM", monthly: 1500, dueDay: 10, status: "Ativo" });
    expect((await recordsModule.listRecords(user.orgId, "clients"))[0].data.name).toBe("Cliente Teste");
    const updated = await recordsModule.updateRecord(user, created.id, "clients", { ...created.data, name: "Cliente Atualizado" });
    expect(updated?.data.name).toBe("Cliente Atualizado");
    expect(await recordsModule.deleteRecord(user, created.id, "clients")).toBe(true);
    expect(await recordsModule.listRecords(user.orgId, "clients")).toHaveLength(0);
    const audit = await dbModule.db.selectFrom("audit_logs").select("action").where("entity_id", "=", created.id).orderBy("id").execute();
    expect(audit.map((x) => x.action)).toEqual(["CREATE", "UPDATE", "DELETE"]);
  });

  it("isola dados entre organizações", async () => {
    const admin = await dbModule.db.selectFrom("users").selectAll().executeTakeFirstOrThrow();
    const user: SessionUser = { id: admin.id, orgId: admin.org_id, name: admin.name, email: admin.email, role: "CEO_ADMIN", mustChangePassword: false };
    await recordsModule.createRecord(user, "tasks", { title: "Tarefa protegida", status: "Aberta", priority: "Média" });
    expect(await recordsModule.listRecords("outra-organizacao", "tasks")).toHaveLength(0);
  });

  it("impede que o administrador remova a própria permissão", async () => {
    const admin = await dbModule.db.selectFrom("users").selectAll().where("email", "=", "admin-test@doctype.local").executeTakeFirstOrThrow();
    const session: SessionUser = { id: admin.id, orgId: admin.org_id, name: admin.name, email: admin.email, role: "CEO_ADMIN", mustChangePassword: false };
    await expect(userManagementModule.updateManagedUser(session, admin.id, { name: admin.name, role: "FINANCE", active: true })).rejects.toThrow("própria permissão");
    const unchanged = await dbModule.db.selectFrom("users").select("role").where("id", "=", admin.id).executeTakeFirstOrThrow();
    expect(unchanged.role).toBe("CEO_ADMIN");
  });

  it("revoga sessões anteriores ao rotacionar credenciais", async () => {
    const admin = await dbModule.db.selectFrom("users").select("id").where("email", "=", "admin-test@doctype.local").executeTakeFirstOrThrow();
    await dbModule.db.deleteFrom("sessions").where("user_id", "=", admin.id).execute();
    await dbModule.db.insertInto("sessions").values([
      { id: crypto.randomUUID(), user_id: admin.id, token_hash: "a".repeat(64), expires_at: "2099-01-01T00:00:00.000Z", created_at: new Date().toISOString() },
      { id: crypto.randomUUID(), user_id: admin.id, token_hash: "b".repeat(64), expires_at: "2099-01-01T00:00:00.000Z", created_at: new Date().toISOString() },
    ]).execute();
    await authModule.rotateUserSessions(admin.id);
    const sessions = await dbModule.db.selectFrom("sessions").select("token_hash").where("user_id", "=", admin.id).execute();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].token_hash).not.toBe("a".repeat(64));
    expect(sessions[0].token_hash).not.toBe("b".repeat(64));
  });

  it("persiste o bloqueio de tentativas de login sem guardar IP ou e-mail", async () => {
    const identifiers = accountSecurityModule.loginThrottleIdentifiers("203.0.113.77", "risk@example.com");
    const now = new Date("2026-08-25T12:00:00.000Z");
    for (let attempt = 0; attempt < 8; attempt += 1) await accountSecurityModule.registerLoginFailure(identifiers, now);
    expect((await accountSecurityModule.loginThrottleStatus(identifiers, now)).blocked).toBe(true);
    const rows = await dbModule.db.selectFrom("login_rate_limits").select("key_hash").execute();
    expect(rows.every((row) => !row.key_hash.includes("203.0.113.77") && !row.key_hash.includes("risk@example.com"))).toBe(true);
    await accountSecurityModule.clearLoginFailures(identifiers);
    expect((await accountSecurityModule.loginThrottleStatus(identifiers, now)).blocked).toBe(false);
  });
});
