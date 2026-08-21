"use client";

import Image from "next/image";
import { AlertTriangle, Bell, CheckCircle2, ChevronRight, CircleDollarSign, Clock3, MessageCircle, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Alert, AppRecord, SessionUser } from "@/lib/types";

type StatePayload = { records: AppRecord[]; alerts: Alert[]; settings: Record<string, unknown>; user: SessionUser; generatedAt: string };

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
  const data = useMemo(() => {
    const invoices = state.records.filter((r) => r.module === "invoices");
    const expenses = state.records.filter((r) => r.module === "expenses");
    const tasks = state.records.filter((r) => r.module === "tasks");
    const clients = state.records.filter((r) => r.module === "clients");
    const today = new Date(state.generatedAt).toISOString().slice(0, 10);
    const revenue = invoices.filter((r) => r.data.status === "Pago").reduce((sum, r) => sum + n(r.data.value), 0);
    const costs = expenses.filter((r) => r.data.status === "Pago").reduce((sum, r) => sum + n(r.data.value), 0);
    const lateTasks = tasks.filter((r) => r.data.status !== "Concluída" && t(r.data.due) && t(r.data.due) < today).length;
    const renewals = clients.filter((r) => {
      if (!r.data.renewal) return false;
      const days = Math.ceil((new Date(`${t(r.data.renewal)}T12:00:00`).getTime() - new Date(state.generatedAt).getTime()) / 86400000);
      return days >= 0 && days <= 30;
    }).length;
    return { revenue, costs, result: revenue - costs, lateTasks, renewals };
  }, [state]);

  const firstName = state.user.name.split(" ")[0] || "DOC HERO";
  const attention = state.alerts.length + data.lateTasks + data.renewals;

  return <>
    <button className="doc-fab" aria-label="Abrir DOC Monitor" onClick={() => setOpen(true)}>
      <span className="doc-fab-ring" aria-hidden="true" />
      <span className="doc-fab-img"><Image src="/assets/guardiao-monitor.webp" alt="DOC Monitor" width={94} height={72} priority /></span>
      {attention > 0 && <b>{Math.min(attention, 99)}</b>}
    </button>

    <aside className={`doc-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
      <header className="doc-drawer-head">
        <div className="doc-drawer-brand"><span className="doc-d-mark">D</span><div><strong>DOC MONITOR</strong><small>O Guardião da sua gestão</small></div></div>
        <span className="doc-online"><i /> Online</span>
        <button aria-label="Fechar DOC Monitor" onClick={() => setOpen(false)}><X size={18} /></button>
      </header>

      <section className="doc-hero-panel">
        <Image className="doc-hero-guardiao" src="/assets/guardiao-monitor.webp" alt="Guardião DOCTYPE" width={156} height={120} priority />
        <div className="doc-speech"><strong>Olá, {firstName}!</strong><p>Estou acompanhando a saúde financeira e operacional em tempo real.</p></div>
      </section>

      <div className="doc-actions">
        <button onClick={() => { clickNav("Visão Geral"); setOpen(false); }}><ShieldCheck /><span><strong>Resumo do dia</strong><small>Ver indicadores principais</small></span><ChevronRight /></button>
        <button onClick={() => { clickNav("DOC Monitor"); setOpen(false); }}><AlertTriangle /><span><strong>Alertas ativos</strong><small>{state.alerts.length} ponto{state.alerts.length === 1 ? "" : "s"} pedindo atenção</small></span><ChevronRight /></button>
        <button onClick={() => { clickNav("Operação"); setOpen(false); }}><Clock3 /><span><strong>Tarefas atrasadas</strong><small>{data.lateTasks} pendência{data.lateTasks === 1 ? "" : "s"} vencida{data.lateTasks === 1 ? "" : "s"}</small></span><ChevronRight /></button>
        <button onClick={() => { clickNav("Renovações"); setOpen(false); }}><RotateCcw /><span><strong>Renovações próximas</strong><small>{data.renewals} contrato{data.renewals === 1 ? "" : "s"} nos próximos 30 dias</small></span><ChevronRight /></button>
      </div>

      <section className="doc-tip">
        <div className="doc-tip-icon"><Image src="/assets/guardiao-monitor.webp" alt="Dica do Guardião" width={56} height={44} /></div>
        <div><strong>Dica do Guardião</strong><p>{data.result < 0 ? "As despesas pagas estão acima das receitas recebidas. Revise o Financeiro." : data.lateTasks ? `Existem ${data.lateTasks} tarefas vencidas. Priorize o que bloqueia a operação.` : data.renewals ? `Há ${data.renewals} renovações próximas. Antecipe contatos e decisões.` : "A operação não tem exceções urgentes agora. Continue acompanhando os indicadores."}</p></div>
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
