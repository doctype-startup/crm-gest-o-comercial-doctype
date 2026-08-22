import { describe, expect, it } from "vitest";
import { buildAlerts } from "@/lib/monitor";
import { canRead, canWrite, moduleSchemas } from "@/lib/modules";
import type { AppRecord, RecordModuleKey } from "@/lib/types";

const record = (module: RecordModuleKey, id: string, data: Record<string, unknown>): AppRecord => ({ id, module, data, createdAt: "2026-08-20T00:00:00Z", updatedAt: "2026-08-20T00:00:00Z" });

describe("permissões e validação", () => {
  it("isola módulos sensíveis por função", () => {
    expect(canWrite("CEO_ADMIN", "accesses")).toBe(true);
    expect(canRead("FINANCE", "invoices")).toBe(true);
    expect(canRead("FINANCE", "accesses")).toBe(false);
    expect(canWrite("OPERATIONS", "invoices")).toBe(false);
    expect(canRead("OPERATIONS", "products")).toBe(true);
    expect(canWrite("FINANCE", "quotes")).toBe(true);
  });

  it("valida dados e remove campos de senha não previstos", () => {
    const parsed = moduleSchemas.accesses.parse({ clientId: "c1", platform: "Meta", password: "segredo", status: "OK" });
    expect(parsed.password).toBeUndefined();
    expect(() => moduleSchemas.clients.parse({ name: "", dueDay: 99 })).toThrow();
  });

  it("valida a jornada comercial produto, cliente, orçamento e contrato", () => {
    const product = moduleSchemas.products.parse({ name: "DOC CRM Pro", sku: "CRM-PRO", category: "CRM", price: 1490, cost: 390, billingType: "Mensal", status: "Ativo" });
    expect(product.price).toBe(1490);

    const client = moduleSchemas.clients.parse({ name: "Cliente Comercial", services: "CRM", productIds: ["p1"], dueDay: 10, status: "Ativo" });
    expect(client.productIds).toEqual(["p1"]);

    const quote = moduleSchemas.quotes.parse({ number: "ORC-001", clientId: "c1", title: "Implantação DOC CRM", productIds: ["p1"], subtotal: 1490, discount: 90, total: 1400, status: "Aprovado" });
    expect(quote.total).toBe(1400);

    const contract = moduleSchemas.contracts.parse({ number: "CTR-001", clientId: "c1", quoteId: "q1", title: "Contrato DOC CRM", productIds: ["p1"], value: 1400, signedAt: "2026-08-21", status: "Assinado", fileName: "contrato.pdf", fileDataUrl: "data:application/pdf;base64,VEVTVEU=" });
    expect(contract.status).toBe("Assinado");
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
