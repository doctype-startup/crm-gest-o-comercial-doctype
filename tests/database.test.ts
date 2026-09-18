import { beforeAll, describe, expect, it } from "vitest";
import { resolveModulePermissions } from "@/lib/modules";
import type { SessionUser } from "@/lib/types";

const adminPermissions = resolveModulePermissions("CEO_ADMIN", []);

process.env.DATABASE_URL = `sqlite:/tmp/doctype-os-vitest-${process.pid}.db`;
process.env.DATABASE_ENGINE = "sqlite";
process.env.SEED_ADMIN_EMAIL = "admin-test@doctype.local";
process.env.SEED_ADMIN_PASSWORD = "Doctype@Teste2026";

let dbModule: typeof import("@/lib/db");
let recordsModule: typeof import("@/lib/records");
let authModule: typeof import("@/lib/auth");
let accountSecurityModule: typeof import("@/lib/account-security");
let userManagementModule: typeof import("@/lib/user-management");
let notificationsModule: typeof import("@/lib/notifications");

beforeAll(async () => {
  dbModule = await import("@/lib/db");
  recordsModule = await import("@/lib/records");
  authModule = await import("@/lib/auth");
  accountSecurityModule = await import("@/lib/account-security");
  userManagementModule = await import("@/lib/user-management");
  notificationsModule = await import("@/lib/notifications");
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
    const user: SessionUser = { id: row.id, orgId: row.org_id, name: row.name, email: row.email, role: "CEO_ADMIN", mustChangePassword: true, modulePermissions: adminPermissions };
    const created = await recordsModule.createRecord(user, "clients", { name: "Cliente Teste", services: "CRM", monthly: 1500, dueDay: 10, status: "Ativo" });
    expect((await recordsModule.listRecords(user.orgId, "clients"))[0].data.name).toBe("Cliente Teste");
    const updated = await recordsModule.updateRecord(user, created.id, "clients", { ...created.data, name: "Cliente Atualizado" });
    expect(updated?.data.name).toBe("Cliente Atualizado");
    expect(await recordsModule.deleteRecord(user, created.id, "clients")).toBe(true);
    expect(await recordsModule.listRecords(user.orgId, "clients")).toHaveLength(0);
    const audit = await dbModule.db.selectFrom("audit_logs").select("action").where("entity_id", "=", created.id).orderBy("id").execute();
    expect(audit.map((x) => x.action)).toEqual(["CREATE", "UPDATE", "DELETE"]);
  });

  it("exclui em cascata os registros do cliente ao removê-lo, e preserva os de outro cliente", async () => {
    const admin = await dbModule.db.selectFrom("users").selectAll().where("email", "=", "admin-test@doctype.local").executeTakeFirstOrThrow();
    const user: SessionUser = { id: admin.id, orgId: admin.org_id, name: admin.name, email: admin.email, role: "CEO_ADMIN", mustChangePassword: false, modulePermissions: adminPermissions };

    const clientA = await recordsModule.createRecord(user, "clients", { name: "Cliente A Cascata", services: "CRM", monthly: 1000, dueDay: 10, status: "Ativo" });
    const clientB = await recordsModule.createRecord(user, "clients", { name: "Cliente B Cascata", services: "CRM", monthly: 1000, dueDay: 10, status: "Ativo" });
    await recordsModule.createRecord(user, "accesses", { clientId: clientA.id, platform: "Instagram", login: "a" });
    await recordsModule.createRecord(user, "invoices", { clientId: clientA.id, description: "Fatura A", value: 100, due: "2026-10-10" });
    const accessB = await recordsModule.createRecord(user, "accesses", { clientId: clientB.id, platform: "Instagram", login: "b" });

    expect(await recordsModule.deleteRecord(user, clientA.id, "clients")).toBe(true);
    expect(await recordsModule.listRecords(user.orgId, "accesses")).toEqual([expect.objectContaining({ id: accessB.id })]);
    expect(await recordsModule.listRecords(user.orgId, "invoices")).toHaveLength(0);

    const audit = await dbModule.db.selectFrom("audit_logs").select("metadata").where("entity_id", "=", clientA.id).where("action", "=", "DELETE").executeTakeFirstOrThrow();
    expect(JSON.parse(audit.metadata).cascaded).toBe(2);
  });

  it("preenche client_id de registros antigos (gravados antes da coluna existir)", async () => {
    const admin = await dbModule.db.selectFrom("users").selectAll().where("email", "=", "admin-test@doctype.local").executeTakeFirstOrThrow();
    const legacyId = crypto.randomUUID();
    const now = new Date().toISOString();
    await dbModule.db.insertInto("records").values({ id: legacyId, org_id: admin.org_id, module: "accesses", data: JSON.stringify({ clientId: "cliente-legado", platform: "Instagram" }), client_id: "", created_by: admin.id, created_at: now, updated_at: now }).execute();

    await dbModule.backfillRecordsClientId();

    const row = await dbModule.db.selectFrom("records").select("client_id").where("id", "=", legacyId).executeTakeFirstOrThrow();
    expect(row.client_id).toBe("cliente-legado");
  });

  it("isola dados entre organizações", async () => {
    const admin = await dbModule.db.selectFrom("users").selectAll().executeTakeFirstOrThrow();
    const user: SessionUser = { id: admin.id, orgId: admin.org_id, name: admin.name, email: admin.email, role: "CEO_ADMIN", mustChangePassword: false, modulePermissions: adminPermissions };
    await recordsModule.createRecord(user, "tasks", { title: "Tarefa protegida", status: "Aberta", priority: "Média" });
    expect(await recordsModule.listRecords("outra-organizacao", "tasks")).toHaveLength(0);
  });

  it("impede que o administrador remova a própria permissão", async () => {
    const admin = await dbModule.db.selectFrom("users").selectAll().where("email", "=", "admin-test@doctype.local").executeTakeFirstOrThrow();
    const session: SessionUser = { id: admin.id, orgId: admin.org_id, name: admin.name, email: admin.email, role: "CEO_ADMIN", mustChangePassword: false, modulePermissions: adminPermissions };
    await expect(userManagementModule.updateManagedUser(session, admin.id, { name: admin.name, role: "FINANCE", active: true })).rejects.toThrow("própria permissão");
    const unchanged = await dbModule.db.selectFrom("users").select("role").where("id", "=", admin.id).executeTakeFirstOrThrow();
    expect(unchanged.role).toBe("CEO_ADMIN");
  });

  it("grava e resolve exceções de permissão por módulo salvas por usuário", async () => {
    const admin = await dbModule.db.selectFrom("users").selectAll().where("email", "=", "admin-test@doctype.local").executeTakeFirstOrThrow();
    const session: SessionUser = { id: admin.id, orgId: admin.org_id, name: admin.name, email: admin.email, role: "CEO_ADMIN", mustChangePassword: false, modulePermissions: adminPermissions };

    const financeUserId = crypto.randomUUID();
    const now = new Date().toISOString();
    await dbModule.db.insertInto("users").values({ id: financeUserId, org_id: admin.org_id, name: "Financeiro Teste", email: `financeiro-${financeUserId}@doctype.local`, password_hash: await authModule.hashPassword("Financeiro@Teste2026"), role: "FINANCE", active: 1, must_change_password: 1, created_at: now, updated_at: now }).execute();

    await userManagementModule.updateManagedUser(session, financeUserId, { name: "Financeiro Teste", role: "FINANCE", active: true, permissions: { accesses: { read: true, write: false } } });
    const rows = await dbModule.db.selectFrom("user_module_permissions").select(["module", "can_read", "can_write"]).where("user_id", "=", financeUserId).execute();
    const modulesModule = await import("@/lib/modules");
    const effective = modulesModule.resolveModulePermissions("FINANCE", rows);
    expect(effective.read).toContain("accesses");
    expect(effective.write).not.toContain("accesses");

    await expect(
      userManagementModule.updateManagedUser(session, financeUserId, { name: "Financeiro Teste", role: "FINANCE", active: true, permissions: { team: { read: false, write: true } } }),
    ).rejects.toThrow("visualização");
  });

  it("notifica (central + tentativa de e-mail) só quem tem acesso ao módulo, e persiste como não lida", async () => {
    const admin = await dbModule.db.selectFrom("users").selectAll().where("email", "=", "admin-test@doctype.local").executeTakeFirstOrThrow();

    const operationsUserId = crypto.randomUUID();
    const now = new Date().toISOString();
    await dbModule.db.insertInto("users").values({ id: operationsUserId, org_id: admin.org_id, name: "Operação Teste", email: `operacao-${operationsUserId}@doctype.local`, password_hash: await authModule.hashPassword("Operacao@Teste2026"), role: "OPERATIONS", active: 1, must_change_password: 1, created_at: now, updated_at: now }).execute();

    // Sem exceção: Operação não lê invoices por padrão, então não deve ser notificada.
    const recipientsBefore = await notificationsModule.usersWithModuleAccess(admin.org_id, "invoices");
    expect(recipientsBefore.some((r) => r.id === operationsUserId)).toBe(false);
    expect(recipientsBefore.some((r) => r.id === admin.id)).toBe(true);

    await notificationsModule.notifyUsers(admin.org_id, recipientsBefore, { title: "Pagamento recebido", body: "Cliente Teste pagou R$ 100,00.", link: "finance" });
    const rows = await dbModule.db.selectFrom("notifications").selectAll().where("org_id", "=", admin.org_id).where("title", "=", "Pagamento recebido").execute();
    expect(rows).toHaveLength(recipientsBefore.length);
    expect(rows.every((row) => row.read === 0)).toBe(true);
    expect(rows.some((row) => row.user_id === admin.id)).toBe(true);
    expect(rows.some((row) => row.user_id === operationsUserId)).toBe(false);
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
