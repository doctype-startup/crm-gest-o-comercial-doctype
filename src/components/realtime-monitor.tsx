"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, CalendarClock, CircleDollarSign, Gauge, RefreshCw, ShieldCheck } from "lucide-react";
import type { AppRecord } from "@/lib/types";

type StatePayload = { records: AppRecord[]; generatedAt: string };

type GaugeMetric = {
  label: string;
  value: number;
  detail: string;
  tone: "good" | "attention" | "critical";
  icon: typeof Gauge;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const number = (value: unknown) => Number(value || 0);
const text = (value: unknown) => String(value ?? "");
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function loadState(): Promise<StatePayload> {
  const response = await fetch("/api/state", { cache: "no-store" });
  if (!response.ok) throw new Error("Não foi possível atualizar o monitor.");
  return response.json();
}

function scoreTone(value: number): GaugeMetric["tone"] {
  if (value >= 75) return "good";
  if (value >= 50) return "attention";
  return "critical";
}

function computeMetrics(records: AppRecord[]): GaugeMetric[] {
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekIso = nextWeek.toISOString().slice(0, 10);

  const tasks = records.filter((record) => record.module === "tasks");
  const completedToday = tasks.filter((record) => text(record.data.status) === "Concluída" && record.updatedAt.slice(0, 10) === today).length;
  const dueTodayOpen = tasks.filter((record) => text(record.data.status) !== "Concluída" && text(record.data.due) === today).length;
  const overdueTasks = tasks.filter((record) => text(record.data.status) !== "Concluída" && text(record.data.due) && text(record.data.due) < today).length;
  const productivityBase = completedToday + dueTodayOpen + overdueTasks;
  const productivity = productivityBase ? clamp((completedToday / productivityBase) * 100) : (tasks.some((record) => text(record.data.status) !== "Concluída") ? 70 : 100);

  const clients = records.filter((record) => record.module === "clients" && text(record.data.status) === "Ativo");
  const monthlyRevenue = clients.reduce((sum, record) => sum + number(record.data.monthly), 0);
  const expenses = records.filter((record) => record.module === "expenses" && text(record.data.status) !== "Cancelado");
  const recurringExpenses = expenses.filter((record) => Boolean(record.data.recurring)).reduce((sum, record) => sum + number(record.data.value), 0);
  const invoices = records.filter((record) => record.module === "invoices" && text(record.data.status) !== "Cancelado");
  const overdueReceivable = invoices.filter((record) => text(record.data.status) !== "Pago" && text(record.data.due) && text(record.data.due) < today).reduce((sum, record) => sum + number(record.data.value), 0);
  const marginPct = monthlyRevenue > 0 ? ((monthlyRevenue - recurringExpenses) / monthlyRevenue) * 100 : (recurringExpenses > 0 ? 0 : 100);
  const overduePct = monthlyRevenue > 0 ? (overdueReceivable / monthlyRevenue) * 100 : (overdueReceivable > 0 ? 100 : 0);
  const financial = clamp(55 + (marginPct * 0.45) - (overduePct * 0.5));

  const datedOpenTasks = tasks.filter((record) => text(record.data.status) !== "Concluída" && text(record.data.due));
  const onTimeOpen = datedOpenTasks.filter((record) => text(record.data.due) >= today).length;
  const deadline = datedOpenTasks.length ? clamp((onTimeOpen / datedOpenTasks.length) * 100) : 100;
  const dueSoon = datedOpenTasks.filter((record) => text(record.data.due) >= today && text(record.data.due) <= nextWeekIso).length;

  return [
    {
      label: "Produtividade do dia",
      value: productivity,
      detail: `${completedToday} concluída${completedToday === 1 ? "" : "s"} hoje • ${dueTodayOpen} para hoje • ${overdueTasks} atrasada${overdueTasks === 1 ? "" : "s"}`,
      tone: scoreTone(productivity),
      icon: Activity,
    },
    {
      label: "Saúde financeira",
      value: financial,
      detail: `Receita mensal ${brl(monthlyRevenue)} • custos recorrentes ${brl(recurringExpenses)} • vencido ${brl(overdueReceivable)}`,
      tone: scoreTone(financial),
      icon: CircleDollarSign,
    },
    {
      label: "Saúde dos prazos",
      value: deadline,
      detail: `${overdueTasks} atrasada${overdueTasks === 1 ? "" : "s"} • ${dueSoon} vencimento${dueSoon === 1 ? "" : "s"} nos próximos 7 dias`,
      tone: scoreTone(deadline),
      icon: CalendarClock,
    },
  ];
}

export function RealtimeMonitor({ initialRecords }: { initialRecords: AppRecord[] }) {
  const [records, setRecords] = useState<AppRecord[]>(initialRecords);
  const [target, setTarget] = useState<Element | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(() => new Date());
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const payload = await loadState();
      setRecords(payload.records);
      setLastUpdate(new Date());
      setError("");
      window.dispatchEvent(new Event("doctype:records-changed"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha de sincronização.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const locate = () => setTarget(document.querySelector(".monitor-layout"));
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    const frame = window.requestAnimationFrame(locate);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 10000);
    const onVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const metrics = useMemo(() => computeMetrics(records), [records]);
  if (!target) return null;

  return createPortal(
    <section className="card realtime-health" aria-label="Saúde operacional em tempo real">
      <div className="realtime-health-head">
        <div>
          <span className="eyebrow"><ShieldCheck size={14} /> DOC MONITOR AO VIVO</span>
          <h2>Saúde da operação</h2>
          <p>Leitura automática dos dados reais do DOC.OS, atualizada a cada 10 segundos.</p>
        </div>
        <div className="live-sync">
          <span><i /> AO VIVO</span>
          <small>{`Atualizado ${lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}</small>
          <button type="button" aria-label="Atualizar monitor agora" onClick={() => void refresh()} disabled={refreshing}><RefreshCw size={15} className={refreshing ? "spin" : ""} /></button>
        </div>
      </div>
      {error && <div className="realtime-health-error">{error}</div>}
      <div className="health-gauges">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return <article className={`health-gauge ${metric.tone}`} key={metric.label}>
            <div className="health-gauge-top"><span><Icon size={18} />{metric.label}</span><strong>{metric.value}%</strong></div>
            <div className="thermometer" role="meter" aria-label={metric.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={metric.value}><i style={{ width: `${metric.value}%` }} /></div>
            <p>{metric.detail}</p>
          </article>;
        })}
      </div>
      <div className="health-legend"><span><i className="good" /> 75–100 Saudável</span><span><i className="attention" /> 50–74 Atenção</span><span><i className="critical" /> 0–49 Crítico</span></div>
    </section>,
    target,
  );
}
