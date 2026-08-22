"use client";

import Image from "next/image";
import { AlertTriangle, Bell, CheckCircle2, ChevronRight, CircleDollarSign, Clock3, MessageCircle, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildMonitorSnapshot } from "@/lib/monitor-engine";
import type { Alert, AppRecord, SessionUser } from "@/lib/types";

type StatePayload = { records: AppRecord[]; alerts: Alert[]; settings: Record<string, unknown>; user: SessionUser; generatedAt: string };
type SyncState = "live" | "syncing" | "stale" | "retrying";

const ROTATION_MS = 7000;
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const n = (value: unknown) => Number(value || 0);
const t = (value: unknown) => String(value ?? "");

function clickNav(label: string) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".sidebar nav button"));
  const target = buttons.find((button) => button.textContent?.trim().toLowerCase().includes(label.toLowerCase()));
  target?.click();
}

export function DocMonitorOverlay({ state }: { state: StatePayload }) {
  const [open, setOpen] = useState(false);
  const [liveState, setLiveState] = useState(state);
  const [syncState, setSyncState] = useState<SyncState>("live");
  const [speechIndex, setSpeechIndex] = useState(0);

  useEffect(() => setLiveState(state), [state]);

  useEffect(() => {
    const onMonitorState = (event: Event) => {
      if (event instanceof CustomEvent<StatePayload> && event.detail) setLiveState(event.detail);
    };
    const onMonitorSync = (event: Event) => {
      if (event instanceof CustomEvent<SyncState> && event.detail) setSyncState(event.detail);
    };
    window.addEventListener("doctype:monitor-state", onMonitorState);
    window.addEventListener("doctype:monitor-sync", onMonitorSync);
    return () => {
      window.removeEventListener("doctype:monitor-state", onMonitorState);
      window.removeEventListener("doctype:monitor-sync", onMonitorSync);
    };
  }, []);

  const data = useMemo(() => {
    const invoices = liveState.records.filter((r) => r.module === "invoices");
    const expenses = liveState.records.filter((r) => r.module === "expenses");
    const tasks = liveState.records.filter((r) => r.module === "tasks");
    const clients = liveState.records.filter((r) => r.module === "clients");
    const today = new Date(liveState.generatedAt).toISOString().slice(0, 10);
    const revenue = invoices.filter((r) => r.data.status === "Pago").reduce((sum, r) => sum + n(r.data.value), 0);
    const costs = expenses.filter((r) => r.data.status === "Pago").reduce((sum, r) => sum + n(r.data.value), 0);
    const lateTasks = tasks.filter((r) => r.data.status !== "Concluída" && t(r.data.due) && t(r.data.due) < today).length;
    const renewals = clients.filter((r) => {
      if (!r.data.renewal) return false;
      const days = Math.ceil((new Date(`${t(r.data.renewal)}T12:00:00`).getTime() - new Date(liveState.generatedAt).getTime()) / 86400000);
      return days >= 0 && days <= 30;
    }).length;
    return { revenue, costs, result: revenue - costs, lateTasks, renewals };
  }, [liveState]);

  const snapshot = useMemo(() => buildMonitorSnapshot(liveState.records, new Date(liveState.generatedAt)), [liveState]);
  const speechSections = snapshot.sections.filter((section) => section.items.length > 0);
  const speechSection = speechSections[speechIndex % Math.max(speechSections.length, 1)];
  const speechItem = speechSection?.items.find((item) => item.tone === "critical") || speechSection?.items.find((item) => item.tone === "attention") || speechSection?.items[0];

  useEffect(() => {
    if (!speechSections.length) return;
    const timer = window.setInterval(() => setSpeechIndex((current) => (current + 1) % speechSections.length), ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [speechSections.length]);

  const firstName = liveState.user.name.split(" ")[0] || "DOC HERO";
  const attention = liveState.alerts.length;
  const syncLabel = syncState === "live" ? "Online" : syncState === "syncing" ? "Sincronizando" : syncState === "stale" ? "Desatualizado" : "Reconectando";
  const speechText = speechSection && speechItem
    ? `${speechSection.title}: ${speechItem.label} ${speechItem.value}. ${speechItem.detail}`
    : "A operação está protegida e sem exceções urgentes neste momento.";

  return <>
    <button className="doc-fab" aria-label={`Abrir DOC Monitor${attention ? `, ${attention} ponto${attention === 1 ? "" : "s"} de atenção` : ""}`} onClick={() => setOpen(true)}>
      <span className="doc-fab-ring" aria-hidden="true" />
      <span className="doc-fab-img"><Image src="/assets/guardiao-monitor.webp" alt="DOC Monitor" width={94} height={72} priority /></span>
      {attention > 0 && <b aria-label={`${attention} ponto${attention === 1 ? "" : "s"} de atenção`}>{Math.min(attention, 99)}</b>}
    </button>

    <aside className={`doc-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
      <header className="doc-drawer-head">
        <div className="doc-drawer-brand"><span className="doc-d-mark">D</span><div><strong>DOC MONITOR</strong><small>O Guardião da sua gestão</small></div></div>
        <span className={`doc-online ${syncState}`}><i /> {syncLabel}</span>
        <button aria-label="Fechar DOC Monitor" onClick={() => setOpen(false)}><X size={18} /></button>
      </header>

      <section className="doc-hero-panel">
        <Image className="doc-hero-guardiao" src="/assets/guardiao-monitor.webp" alt="Guardião DOCTYPE" width={156} height={120} priority />
        <div className={`doc-speech ${speechItem?.tone || "neutral"}`} aria-live="polite">
          <strong>Olá, {firstName}!</strong>
          <p>{speechText}</p>
          {speechSections.length > 1 && <small>{speechIndex % speechSections.length + 1}/{speechSections.length} • atualização automática</small>}
        </div>
      </section>

      <div className="doc-actions">
        <button onClick={() => { clickNav("Visão Geral"); setOpen(false); }}><ShieldCheck /><span><strong>Resumo do dia</strong><small>Ver indicadores principais</small></span><ChevronRight /></button>
        <button onClick={() => { clickNav("DOC Monitor"); setOpen(false); }}><AlertTriangle /><span><strong>Alertas ativos</strong><small>{attention} ponto{attention === 1 ? "" : "s"} pedindo atenção</small></span><ChevronRight /></button>
        <button onClick={() => { clickNav("Operação"); setOpen(false); }}><Clock3 /><span><strong>Tarefas atrasadas</strong><small>{data.lateTasks} pendência{data.lateTasks === 1 ? "" : "s"} vencida{data.lateTasks === 1 ? "" : "s"}</small></span><ChevronRight /></button>
        <button onClick={() => { clickNav("Renovações"); setOpen(false); }}><RotateCcw /><span><strong>Renovações próximas</strong><small>{data.renewals} contrato{data.renewals === 1 ? "" : "s"} nos próximos 30 dias</small></span><ChevronRight /></button>
      </div>

      <section className="doc-tip">
        <div className="doc-tip-icon"><Image src="/assets/guardiao-monitor.webp" alt="Dica do Guardião" width={56} height={44} /></div>
        <div><strong>Dica do Guardião</strong><p>{data.result < 0 ? "As despesas pagas estão acima das receitas recebidas. Revise o Financeiro." : data.lateTasks ? `Existem ${data.lateTasks} tarefas vencidas. Priorize o que bloqueia a operação.` : data.renewals ? `Há ${data.renewals} renovações próximas. Antecipe contatos e decisões.` : attention ? `Há ${attention} ponto${attention === 1 ? "" : "s"} de atenção ativo${attention === 1 ? "" : "s"}. Abra o DOC Monitor para priorizar.` : "A operação não tem exceções urgentes agora. Continue acompanhando os indicadores."}</p></div>
      </section>

      <section className="doc-mini-finance">
        <div><CircleDollarSign /><span>Recebido</span><strong>{money(data.revenue)}</strong></div>
        <div><Bell /><span>Despesas</span><strong>{money(data.costs)}</strong></div>
        <div className={data.result < 0 ? "negative" : "positive"}><CheckCircle2 /><span>Resultado</span><strong>{money(data.result)}</strong></div>
      </section>

      <section className="doc-question">
        <div><MessageCircle size={18} /><strong>Pergunte ao Guardião</strong></div>
        <p>Atalhos para navegar pelos dados da gestão.</p>
        <button onClick={() => { clickNav("Financeiro"); setOpen(false); }}>Como está o financeiro?</button>
        <button onClick={() => { clickNav("Renovações"); setOpen(false); }}>Quais contratos vencem em breve?</button>
        <button onClick={() => { clickNav("Operação"); setOpen(false); }}>Quais tarefas exigem atenção?</button>
      </section>
    </aside>
    {open && <button className="doc-drawer-backdrop" aria-label="Fechar DOC Monitor" onClick={() => setOpen(false)} />}
  </>;
}
