import { describe, expect, it } from "vitest";
import { buildMonitorSnapshot } from "@/lib/monitor-engine";
import type { AppRecord, RecordModuleKey } from "@/lib/types";

const record = (module: RecordModuleKey, id: string, data: Record<string, unknown>, updatedAt = "2026-08-22T12:00:00Z"): AppRecord => ({ id, module, data, createdAt: "2026-08-20T00:00:00Z", updatedAt });

describe("DOC Monitor observability engine", () => {
  it("consolida todos os módulos sem alterar os registros de origem", () => {
    const records: AppRecord[] = [
      record("clients", "c1", { name: "Cliente A", status: "Ativo", health: "Risco", renewal: "2026-09-01", monthly: 3000 }),
      record("accesses", "a1", { clientId: "c1", platform: "Meta", status: "OK", twoFA: false }),
      record("invoices", "i1", { clientId: "c1", value: 1200, due: "2026-08-20", status: "Pendente" }),
      record("expenses", "e1", { name: "Software", value: 500, recurring: true, due: "2026-08-20", status: "Previsto" }),
      record("tasks", "t1", { title: "Campanha", status: "Aberta", priority: "Crítica", due: "2026-08-20", responsible: "DOC HERO" }),
      record("crm", "crm1", { status: "Ativo", monthly: 900 }),
      record("team", "u1", { name: "DOC HERO", status: "Ativo" }),
      record("products", "p1", { name: "DOC CRM", status: "Ativo", price: 1490 }),
      record("quotes", "q1", { status: "Enviado", total: 1490 }),
      record("contracts", "ct1", { status: "Assinado", value: 1490, endDate: "2026-09-10" }),
    ];
    const before = JSON.stringify(records);
    const snapshot = buildMonitorSnapshot(records, new Date("2026-08-22T12:00:00Z"));

    expect(snapshot.recordCount).toBe(10);
    expect(snapshot.sections.map((section) => section.id)).toEqual(["executive", "operation", "finance", "clients", "commercial", "crm-security"]);
    expect(snapshot.criticalCount).toBeGreaterThan(0);
    expect(snapshot.warningCount).toBeGreaterThan(0);
    expect(snapshot.sections.find((section) => section.id === "finance")?.items.find((item) => item.id === "overdue-receivable")?.value).toContain("1.200,00");
    expect(snapshot.sections.find((section) => section.id === "commercial")?.items.find((item) => item.id === "contracts")?.detail).toContain("1 encerram");
    expect(snapshot.sections.find((section) => section.id === "crm-security")?.items.find((item) => item.id === "twofa")?.value).toBe("1");
    expect(JSON.stringify(records)).toBe(before);
  });

  it("permanece estável quando módulos não têm dados", () => {
    const snapshot = buildMonitorSnapshot([], new Date("2026-08-22T12:00:00Z"));
    expect(snapshot.recordCount).toBe(0);
    expect(snapshot.sections).toHaveLength(6);
    expect(snapshot.sections.every((section) => section.items.length === 4)).toBe(true);
  });
});
