import { describe, expect, it } from "vitest";
import { buildAlerts } from "@/lib/monitor";
import type { AppRecord, RecordModuleKey } from "@/lib/types";

const record = (module: RecordModuleKey, id: string, data: Record<string, unknown>, updatedAt = "2026-08-22T12:00:00Z"): AppRecord => ({ id, module, data, createdAt: "2026-08-20T00:00:00Z", updatedAt });

describe("buildAlerts — eventos financeiros ao vivo", () => {
  it("gera alerta de pagamento recebido quando a fatura foi paga hoje", () => {
    const now = new Date("2026-08-22T12:00:00Z");
    const records: AppRecord[] = [
      record("clients", "c1", { name: "Cliente A" }),
      record("invoices", "i1", { clientId: "c1", value: 1500, status: "Pago", paidAt: "2026-08-22" }),
      record("invoices", "i2", { clientId: "c1", value: 500, status: "Pago", paidAt: "2026-08-10" }),
    ];
    const alerts = buildAlerts(records, now);
    expect(alerts.find((a) => a.id === "paid-i1")?.title).toBe("Pagamento recebido");
    expect(alerts.find((a) => a.id === "paid-i2")).toBeUndefined();
  });

  it("gera alerta crítico de fluxo de caixa negativo no mês, líquido de impostos", () => {
    const now = new Date("2026-08-22T12:00:00Z");
    const records: AppRecord[] = [
      record("invoices", "i1", { value: 1000, due: "2026-08-15", status: "Pendente" }),
      record("expenses", "e1", { value: 900, due: "2026-08-20", status: "Previsto" }),
    ];
    // Sem imposto: 1000 - 900 = 100 (positivo) — não deve alertar.
    expect(buildAlerts(records, now, 0).some((a) => a.title === "Fluxo de caixa negativo no mês")).toBe(false);
    // Com 20% de imposto: 1000*0.8 - 900 = -100 (negativo) — deve alertar.
    const withTax = buildAlerts(records, now, 20);
    const cashflowAlert = withTax.find((a) => a.title === "Fluxo de caixa negativo no mês");
    expect(cashflowAlert?.severity).toBe("critical");
  });

  it("ignora fatura/despesa cancelada no cálculo do fluxo de caixa do mês", () => {
    const now = new Date("2026-08-22T12:00:00Z");
    const records: AppRecord[] = [
      record("invoices", "i1", { value: 100, due: "2026-08-15", status: "Cancelado" }),
      record("expenses", "e1", { value: 5000, due: "2026-08-20", status: "Cancelado" }),
    ];
    expect(buildAlerts(records, now, 0).some((a) => a.title === "Fluxo de caixa negativo no mês")).toBe(false);
  });
});
