import type { AppRecord } from "./types";

export type MonitorTone = "good" | "attention" | "critical" | "neutral";

export interface MonitorItem {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: MonitorTone;
}

export interface MonitorSection {
  id: string;
  title: string;
  subtitle: string;
  tone: MonitorTone;
  items: MonitorItem[];
}

export interface MonitorSnapshot {
  sections: MonitorSection[];
  criticalCount: number;
  warningCount: number;
  recordCount: number;
}

const text = (value: unknown) => String(value ?? "");
const num = (value: unknown) => Number(value || 0);
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const todayIso = (now: Date) => now.toISOString().slice(0, 10);

function plusDaysIso(now: Date, days: number) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toneFromCount(critical: number, warning = 0): MonitorTone {
  if (critical > 0) return "critical";
  if (warning > 0) return "attention";
  return "good";
}

function isOpenStatus(value: unknown) {
  return !["Pago", "Concluída", "Cancelado", "Revogado", "Inativo", "Recusado", "Vencido"].includes(text(value));
}

export function buildMonitorSnapshot(records: AppRecord[], now = new Date()): MonitorSnapshot {
  const today = todayIso(now);
  const next7 = plusDaysIso(now, 7);
  const next30 = plusDaysIso(now, 30);

  const clients = records.filter((r) => r.module === "clients");
  const activeClients = clients.filter((r) => text(r.data.status) === "Ativo");
  const riskClients = activeClients.filter((r) => text(r.data.health) === "Risco");
  const renewal30 = activeClients.filter((r) => {
    const renewal = text(r.data.renewal);
    return renewal && renewal >= today && renewal <= next30;
  });
  const monthlyRevenue = activeClients.reduce((sum, r) => sum + num(r.data.monthly), 0);

  const tasks = records.filter((r) => r.module === "tasks");
  const openTasks = tasks.filter((r) => text(r.data.status) !== "Concluída");
  const overdueTasks = openTasks.filter((r) => text(r.data.due) && text(r.data.due) < today);
  const criticalTasks = openTasks.filter((r) => text(r.data.priority) === "Crítica");
  const completedToday = tasks.filter((r) => text(r.data.status) === "Concluída" && r.updatedAt.slice(0, 10) === today);
  const due7 = openTasks.filter((r) => text(r.data.due) >= today && text(r.data.due) <= next7);
  const byResponsible = new Map<string, number>();
  for (const task of overdueTasks) {
    const owner = text(task.data.responsible) || "Sem responsável";
    byResponsible.set(owner, (byResponsible.get(owner) || 0) + 1);
  }
  const topOverdueOwner = [...byResponsible.entries()].sort((a, b) => b[1] - a[1])[0];

  const invoices = records.filter((r) => r.module === "invoices" && text(r.data.status) !== "Cancelado");
  const receivable = invoices.filter((r) => text(r.data.status) !== "Pago").reduce((sum, r) => sum + num(r.data.value), 0);
  const overdueInvoices = invoices.filter((r) => text(r.data.status) !== "Pago" && text(r.data.due) && text(r.data.due) < today);
  const overdueReceivable = overdueInvoices.reduce((sum, r) => sum + num(r.data.value), 0);
  const expenses = records.filter((r) => r.module === "expenses" && text(r.data.status) !== "Cancelado");
  const recurringExpenses = expenses.filter((r) => Boolean(r.data.recurring)).reduce((sum, r) => sum + num(r.data.value), 0);
  const overdueExpenses = expenses.filter((r) => text(r.data.status) !== "Pago" && text(r.data.due) && text(r.data.due) < today);
  const operatingMargin = monthlyRevenue - recurringExpenses;

  const accesses = records.filter((r) => r.module === "accesses" && text(r.data.status) !== "Revogado");
  const unsafeAccesses = accesses.filter((r) => !r.data.twoFA);
  const team = records.filter((r) => r.module === "team");

  const crm = records.filter((r) => r.module === "crm");
  const activeCrm = crm.filter((r) => text(r.data.status) === "Ativo");
  const crmMrr = activeCrm.reduce((sum, r) => sum + num(r.data.monthly), 0);

  const products = records.filter((r) => r.module === "products");
  const activeProducts = products.filter((r) => text(r.data.status) === "Ativo");
  const quotes = records.filter((r) => r.module === "quotes");
  const approvedQuotes = quotes.filter((r) => text(r.data.status) === "Aprovado");
  const openQuotes = quotes.filter((r) => ["Rascunho", "Enviado"].includes(text(r.data.status)));
  const contracts = records.filter((r) => r.module === "contracts");
  const signedContracts = contracts.filter((r) => text(r.data.status) === "Assinado");
  const contractValue = signedContracts.reduce((sum, r) => sum + num(r.data.value), 0);
  const contractsEnding30 = signedContracts.filter((r) => {
    const end = text(r.data.endDate);
    return end && end >= today && end <= next30;
  });

  const criticalCount = overdueTasks.length + criticalTasks.length + riskClients.length + overdueInvoices.length;
  const warningCount = renewal30.length + overdueExpenses.length + unsafeAccesses.length + openQuotes.length;

  const sections: MonitorSection[] = [
    {
      id: "executive",
      title: "Pulso do DOC.OS",
      subtitle: "Leitura consolidada dos módulos disponíveis para este usuário.",
      tone: toneFromCount(criticalCount, warningCount),
      items: [
        { id: "records", label: "Registros monitorados", value: String(records.length), detail: "Base autorizada desta sessão", tone: "neutral" },
        { id: "clients", label: "Clientes ativos", value: String(activeClients.length), detail: `${riskClients.length} em risco`, tone: riskClients.length ? "critical" : "good" },
        { id: "mrr", label: "MRR de clientes", value: brl(monthlyRevenue), detail: "Receita mensal cadastrada", tone: operatingMargin < 0 ? "critical" : "good" },
        { id: "alerts", label: "Pontos de atenção", value: String(criticalCount + warningCount), detail: `${criticalCount} críticos • ${warningCount} atenção`, tone: toneFromCount(criticalCount, warningCount) },
      ],
    },
    {
      id: "operation",
      title: "Operação e produtividade",
      subtitle: "Tarefas, prioridades, atrasos e execução diária.",
      tone: toneFromCount(overdueTasks.length + criticalTasks.length, due7.length),
      items: [
        { id: "open-tasks", label: "Tarefas abertas", value: String(openTasks.length), detail: `${completedToday.length} concluídas hoje`, tone: openTasks.length ? "neutral" : "good" },
        { id: "overdue-tasks", label: "Tarefas atrasadas", value: String(overdueTasks.length), detail: topOverdueOwner ? `${topOverdueOwner[0]} concentra ${topOverdueOwner[1]}` : "Nenhum atraso identificado", tone: overdueTasks.length ? "critical" : "good" },
        { id: "critical-tasks", label: "Prioridade crítica", value: String(criticalTasks.length), detail: "Tarefas críticas ainda abertas", tone: criticalTasks.length ? "critical" : "good" },
        { id: "due-soon", label: "Próximos 7 dias", value: String(due7.length), detail: "Prazos abertos no período", tone: due7.length ? "attention" : "good" },
      ],
    },
    {
      id: "finance",
      title: "Saúde financeira",
      subtitle: "Receita recorrente, contas a receber, custos e inadimplência.",
      tone: toneFromCount(overdueInvoices.length, overdueExpenses.length),
      items: [
        { id: "receivable", label: "A receber", value: brl(receivable), detail: `${invoices.filter((r) => isOpenStatus(r.data.status)).length} lançamentos em aberto`, tone: "neutral" },
        { id: "overdue-receivable", label: "Recebimentos vencidos", value: brl(overdueReceivable), detail: `${overdueInvoices.length} faturas vencidas`, tone: overdueInvoices.length ? "critical" : "good" },
        { id: "recurring-cost", label: "Custos recorrentes", value: brl(recurringExpenses), detail: "Despesas recorrentes não canceladas", tone: "neutral" },
        { id: "margin", label: "Margem operacional", value: brl(operatingMargin), detail: "MRR de clientes menos custos recorrentes", tone: operatingMargin < 0 ? "critical" : operatingMargin < monthlyRevenue * 0.25 ? "attention" : "good" },
      ],
    },
    {
      id: "clients",
      title: "Clientes e renovações",
      subtitle: "Carteira ativa, saúde e datas de renovação.",
      tone: toneFromCount(riskClients.length, renewal30.length),
      items: [
        { id: "active-clients", label: "Carteira ativa", value: String(activeClients.length), detail: `${clients.length} clientes cadastrados`, tone: "neutral" },
        { id: "risk-clients", label: "Clientes em risco", value: String(riskClients.length), detail: riskClients.length ? "Exigem acompanhamento" : "Nenhum cliente marcado em risco", tone: riskClients.length ? "critical" : "good" },
        { id: "renewals", label: "Renovações em 30 dias", value: String(renewal30.length), detail: "Contratos de clientes ativos", tone: renewal30.length ? "attention" : "good" },
        { id: "avg-ticket", label: "Ticket mensal médio", value: brl(activeClients.length ? monthlyRevenue / activeClients.length : 0), detail: "MRR dividido pela carteira ativa", tone: "neutral" },
      ],
    },
    {
      id: "commercial",
      title: "Comercial",
      subtitle: "Produtos, propostas e contratos em uma única leitura.",
      tone: toneFromCount(0, openQuotes.length + contractsEnding30.length),
      items: [
        { id: "products", label: "Produtos ativos", value: String(activeProducts.length), detail: `${products.length} produtos cadastrados`, tone: "neutral" },
        { id: "quotes", label: "Orçamentos aprovados", value: String(approvedQuotes.length), detail: `${openQuotes.length} em rascunho ou enviados`, tone: openQuotes.length ? "attention" : "good" },
        { id: "contracts", label: "Contratos assinados", value: String(signedContracts.length), detail: `${contractsEnding30.length} encerram em até 30 dias`, tone: contractsEnding30.length ? "attention" : "good" },
        { id: "contract-value", label: "Valor contratado", value: brl(contractValue), detail: "Soma dos contratos assinados", tone: "neutral" },
      ],
    },
    {
      id: "crm-security",
      title: "DOC CRM, equipe e segurança",
      subtitle: "Assinaturas, estrutura interna e proteção de acessos.",
      tone: toneFromCount(0, unsafeAccesses.length),
      items: [
        { id: "crm-active", label: "DOC CRM ativo", value: String(activeCrm.length), detail: `${crm.length} assinaturas cadastradas`, tone: "neutral" },
        { id: "crm-mrr", label: "MRR DOC CRM", value: brl(crmMrr), detail: "Receita recorrente informada nas assinaturas", tone: "neutral" },
        { id: "team", label: "Equipe cadastrada", value: String(team.length), detail: "Registros disponíveis ao monitor", tone: "neutral" },
        { id: "twofa", label: "Acessos sem 2FA", value: String(unsafeAccesses.length), detail: `${accesses.length} acessos ativos monitorados`, tone: unsafeAccesses.length ? "attention" : "good" },
      ],
    },
  ];

  return { sections, criticalCount, warningCount, recordCount: records.length };
}
