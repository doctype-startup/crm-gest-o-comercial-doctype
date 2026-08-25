import { beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/types";

process.env.DATABASE_URL = `sqlite:/tmp/doctype-os-vitest-${process.pid}.db`;
process.env.DATABASE_ENGINE = "sqlite";
process.env.SEED_ADMIN_EMAIL = "admin-test@doctype.local";
process.env.SEED_ADMIN_PASSWORD = "Doctype@Teste2026";

let dbModule: typeof import("@/lib/db");
let recordsModule: typeof import("@/lib/records");
let authModule: typeof import("@/lib/auth");

beforeAll(async () => {
  dbModule = await import("@/lib/db");
  recordsModule = await import("@/lib/records");
  authModule = await import("@/lib/auth");
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
});
