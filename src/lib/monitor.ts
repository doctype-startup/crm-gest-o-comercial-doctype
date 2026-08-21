import type { Alert, AppRecord } from "./types";

const str = (value: unknown) => String(value ?? "");
const num = (value: unknown) => Number(value || 0);
const daysUntil = (date: unknown, now = new Date()) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(date));
  if (!match) return null;
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86400000);
};

export function buildAlerts(records: AppRecord[], now = new Date()): Alert[] {
  const alerts: Alert[] = [];
  const clients = new Map(records.filter((r) => r.module === "clients").map((r) => [r.id, str(r.data.name)]));
  const label = (id: unknown) => clients.get(str(id)) || "Cliente não identificado";

  for (const record of records) {
    const d = record.data;
    if (record.module === "accesses" && d.status !== "Revogado" && !d.twoFA) {
      alerts.push({ id: `2fa-${record.id}`, severity: "warning", title: "2FA pendente", detail: `${str(d.platform)} · ${label(d.clientId)}`, module: "accesses" });
    }
    if (record.module === "invoices" && !["Pago", "Cancelado"].includes(str(d.status))) {
      const days = daysUntil(d.due, now);
      if (days !== null && days < 0) alerts.push({ id: `invoice-${record.id}`, severity: "critical", title: "Recebimento vencido", detail: `${label(d.clientId)} · R$ ${num(d.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, module: "finance" });
    }
    if (record.module === "expenses" && !["Pago", "Cancelado"].includes(str(d.status))) {
      const days = daysUntil(d.due, now);
      if (days !== null && days < 0) alerts.push({ id: `expense-${record.id}`, severity: "warning", title: "Despesa vencida", detail: str(d.name), module: "finance" });
    }
    if (record.module === "tasks" && d.status !== "Concluída") {
      const days = daysUntil(d.due, now);
      if (days !== null && days < 0) alerts.push({ id: `task-${record.id}`, severity: d.priority === "Crítica" ? "critical" : "warning", title: "Tarefa atrasada", detail: str(d.title), module: "tasks" });
      else if (d.priority === "Crítica") alerts.push({ id: `critical-${record.id}`, severity: "critical", title: "Tarefa crítica aberta", detail: str(d.title), module: "tasks" });
    }
    if (record.module === "clients" && d.status === "Ativo") {
      const days = daysUntil(d.renewal, now);
      if (days !== null && [30, 15, 7, 0].includes(days)) alerts.push({ id: `renewal-${record.id}`, severity: days <= 7 ? "critical" : "info", title: `Renovação D${days ? `-${days}` : "0"}`, detail: str(d.name), module: "renewals" });
      if (d.health === "Risco") alerts.push({ id: `health-${record.id}`, severity: "critical", title: "Cliente em risco", detail: str(d.name), module: "clients" });
    }
  }

  const weight = { critical: 0, warning: 1, info: 2 } as const;
  return alerts.sort((a, b) => weight[a.severity] - weight[b.severity]);
}
