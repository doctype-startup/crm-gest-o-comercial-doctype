import { describe, expect, it } from "vitest";
import { buildAlerts } from "@/lib/monitor";
import { canRead, canWrite, moduleSchemas } from "@/lib/modules";
import type { AppRecord, ModuleKey } from "@/lib/types";

const record = (module: ModuleKey, id: string, data: Record<string, unknown>): AppRecord => ({ id, module, data, createdAt: "2026-08-20T00:00:00Z", updatedAt: "2026-08-20T00:00:00Z" });

describe("permissões e validação", () => {
  it("isola módulos sensíveis por função", () => {
    expect(canWrite("CEO_ADMIN", "accesses")).toBe(true);
    expect(canRead("FINANCE", "invoices")).toBe(true);
    expect(canRead("FINANCE", "accesses")).toBe(false);
    expect(canWrite("OPERATIONS", "invoices")).toBe(false);
  });

  it("valida dados e remove campos de senha não previstos", () => {
    const parsed = moduleSchemas.accesses.parse({ clientId: "c1", platform: "Meta", password: "segredo", status: "OK" });
    expect(parsed.password).toBeUndefined();
    expect(() => moduleSchemas.clients.parse({ name: "", dueDay: 99 })).toThrow();
  });
});

describe("DOC Monitor", () => {
  it("prioriza inadimplência, tarefa crítica, 2FA e renovação", () => {
    const alerts = buildAlerts([
      record("clients", "c1", { name: "Implaface", status: "Ativo", health: "Risco", renewal: "2026-09-19" }),
      record("accesses", "a1", { clientId: "c1", platform: "Instagram", twoFA: false, status: "OK" }),
      record("invoices", "i1", { clientId: "c1", value: 1200, due: "2026-08-19", status: "Pendente" }),
      record("tasks", "t1", { title: "Publicar campanha", due: "2026-08-19", status: "Aberta", priority: "Crítica" }),
    ], new Date("2026-08-20T12:00:00-03:00"));
    expect(alerts.map((a) => a.title)).toEqual(expect.arrayContaining(["Cliente em risco", "2FA pendente", "Recebimento vencido", "Tarefa atrasada", "Renovação D-30"]));
    expect(alerts[0].severity).toBe("critical");
  });
});
