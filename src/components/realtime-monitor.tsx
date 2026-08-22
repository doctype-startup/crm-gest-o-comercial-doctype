"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, CalendarClock, ChevronLeft, ChevronRight, CircleDollarSign, Gauge, RefreshCw, ShieldCheck } from "lucide-react";
import { buildMonitorSnapshot } from "@/lib/monitor-engine";
import type { Alert, AppRecord, SessionUser } from "@/lib/types";

type StatePayload = { records: AppRecord[]; alerts: Alert[]; settings: Record<string, unknown>; user: SessionUser; generatedAt: string };
type SyncState = "live" | "syncing" | "stale" | "retrying";
type GaugeMetric = { label: string; value: number; detail: string; tone: "good" | "attention" | "critical"; icon: typeof Gauge };

const POLL_MS = 3000;
const ROTATION_MS = 7000;
const STALE_MS = 15000;
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const number = (value: unknown) => Number(value || 0);
const text = (value: unknown) => String(value ?? "");
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function loadState(signal?: AbortSignal): Promise<StatePayload> {
  const response = await fetch("/api/state", { cache: "no-store", signal });
  if (!response.ok) throw new Error("Não foi possível atualizar o monitor.");
  return response.json();
}

function recordsSignature(records: AppRecord[]) {
  return records.map((record) => `${record.id}:${record.updatedAt}`).sort().join("|");
}

function publishMonitorState(payload: StatePayload) {
  window.dispatchEvent(new CustomEvent<StatePayload>("doctype:monitor-state", { detail: payload }));
}

function publishSyncState(syncState: SyncState) {
  window.dispatchEvent(new CustomEvent<SyncState>("doctype:monitor-sync", { detail: syncState }));
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
    { label: "Produtividade do dia", value: productivity, detail: `${completedToday} concluída${completedToday === 1 ? "" : "s"} hoje • ${dueTodayOpen} para hoje • ${overdueTasks} atrasada${overdueTasks === 1 ? "" : "s"}`, tone: scoreTone(productivity), icon: Activity },
    { label: "Saúde financeira", value: financial, detail: `Receita mensal ${brl(monthlyRevenue)} • custos recorrentes ${brl(recurringExpenses)} • vencido ${brl(overdueReceivable)}`, tone: scoreTone(financial), icon: CircleDollarSign },
    { label: "Saúde dos prazos", value: deadline, detail: `${overdueTasks} atrasada${overdueTasks === 1 ? "" : "s"} • ${dueSoon} vencimento${dueSoon === 1 ? "" : "s"} nos próximos 7 dias`, tone: scoreTone(deadline), icon: CalendarClock },
  ];
}

export function RealtimeMonitor({ initialRecords }: { initialRecords: AppRecord[] }) {
  const [records, setRecords] = useState<AppRecord[]>(initialRecords);
  const [target, setTarget] = useState<Element | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(() => new Date());
  const [syncState, setSyncState] = useState<SyncState>("live");
  const [error, setError] = useState("");
  const [sectionIndex, setSectionIndex] = useState(0);
  const inflight = useRef<Promise<void> | null>(null);
  const queued = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const signatureRef = useRef(recordsSignature(initialRecords));
  const lastUpdateRef = useRef(lastUpdate);
  const syncStateRef = useRef<SyncState>("live");
  const errorRef = useRef("");

  const setAndPublishSync = useCallback((next: SyncState) => {
    syncStateRef.current = next;
    setSyncState(next);
    publishSyncState(next);
  }, []);

  const performRefresh = useCallback(async () => {
    if (inflight.current) {
      queued.current = true;
      return inflight.current;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setAndPublishSync(errorRef.current ? "retrying" : "syncing");
    const job = (async () => {
      try {
        const payload = await loadState(controller.signal);
        const nextSignature = recordsSignature(payload.records);
        const changed = nextSignature !== signatureRef.current;
        signatureRef.current = nextSignature;
        const nextUpdate = new Date(payload.generatedAt || Date.now());
        lastUpdateRef.current = nextUpdate;
        setRecords(payload.records);
        setLastUpdate(nextUpdate);
        errorRef.current = "";
        setError("");
        setAndPublishSync("live");
        publishMonitorState(payload);
        if (changed) window.dispatchEvent(new CustomEvent("doctype:records-changed", { detail: { source: "monitor" } }));
      } catch (cause) {
        if (controller.signal.aborted) return;
        const message = cause instanceof Error ? cause.message : "Falha de sincronização.";
        errorRef.current = message;
        setError(message);
        setAndPublishSync("retrying");
      } finally {
        inflight.current = null;
        abortRef.current = null;
        if (queued.current) {
          queued.current = false;
          void performRefresh();
        }
      }
    })();
    inflight.current = job;
    return job;
  }, [setAndPublishSync]);

  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void performRefresh();
    }, 120);
  }, [performRefresh]);

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
    const poll = window.setInterval(() => { if (!document.hidden) void performRefresh(); }, POLL_MS);
    const staleCheck = window.setInterval(() => {
      if (!document.hidden && Date.now() - lastUpdateRef.current.getTime() > STALE_MS && syncStateRef.current !== "syncing") setAndPublishSync("stale");
    }, 3000);
    const onVisibility = () => { if (!document.hidden) void performRefresh(); };
    const onRecordsChanged = (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.source === "monitor") return;
      scheduleRefresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("doctype:records-changed", onRecordsChanged);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(staleCheck);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("doctype:records-changed", onRecordsChanged);
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [performRefresh, scheduleRefresh, setAndPublishSync]);

  const snapshot = useMemo(() => buildMonitorSnapshot(records), [records]);
  const metrics = useMemo(() => computeMetrics(records), [records]);
  const section = snapshot.sections[sectionIndex % snapshot.sections.length];

  useEffect(() => {
    const rotation = window.setInterval(() => setSectionIndex((current) => (current + 1) % Math.max(snapshot.sections.length, 1)), ROTATION_MS);
    return () => window.clearInterval(rotation);
  }, [snapshot.sections.length]);

  if (!target || !section) return null;
  const syncLabel = syncState === "live" ? "AO VIVO" : syncState === "syncing" ? "SINCRONIZANDO" : syncState === "stale" ? "DADOS DESATUALIZADOS" : "RECONECTANDO";

  return createPortal(
    <section className="card realtime-health" aria-label="Saúde operacional em tempo real">
      <div className="realtime-health-head">
        <div>
          <span className="eyebrow"><ShieldCheck size={14} /> DOC MONITOR AO VIVO</span>
          <h2>Saúde da operação</h2>
          <p>Eventos do CRM atualizam o Guardião imediatamente; uma leitura redundante reconcilia o estado a cada 3 segundos.</p>
        </div>
        <div className={`live-sync ${syncState}`}>
          <span><i /> {syncLabel}</span>
          <small>{`Última leitura válida ${lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}</small>
          <button type="button" aria-label="Atualizar monitor agora" onClick={() => void performRefresh()} disabled={syncState === "syncing"}><RefreshCw size={15} className={syncState === "syncing" ? "spin" : ""} /></button>
        </div>
      </div>

      {error && <div className="realtime-health-error">O monitor manteve a última leitura válida. Tentando sincronizar novamente: {error}</div>}

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

      <div className={`monitor-rotation ${section.tone}`} data-section={section.id} aria-live="polite">
        <div className="monitor-rotation-head">
          <div><span>LEITURA {sectionIndex % snapshot.sections.length + 1}/{snapshot.sections.length}</span><h3>{section.title}</h3><p>{section.subtitle}</p></div>
          <div className="monitor-rotation-controls">
            <button type="button" aria-label="Informação anterior" onClick={() => setSectionIndex((current) => (current - 1 + snapshot.sections.length) % snapshot.sections.length)}><ChevronLeft size={17} /></button>
            <button type="button" aria-label="Próxima informação" onClick={() => setSectionIndex((current) => (current + 1) % snapshot.sections.length)}><ChevronRight size={17} /></button>
          </div>
        </div>
        <div className="monitor-rotation-grid">
          {section.items.map((item) => <article className={`monitor-live-item ${item.tone}`} key={item.id}><span>{item.label}</span><strong>{item.value}</strong><p>{item.detail}</p></article>)}
        </div>
        <div className="monitor-dots" aria-label="Seções do monitor">{snapshot.sections.map((candidate, index) => <button type="button" key={candidate.id} className={index === sectionIndex % snapshot.sections.length ? "active" : ""} aria-label={`Abrir ${candidate.title}`} onClick={() => setSectionIndex(index)} />)}</div>
      </div>

      <div className="health-legend"><span><i className="good" /> Saudável</span><span><i className="attention" /> Atenção</span><span><i className="critical" /> Crítico</span><span>{snapshot.recordCount} registros na leitura atual</span></div>
    </section>,
    target,
  );
}
