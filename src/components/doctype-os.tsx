"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, AlertTriangle, ArchiveRestore, BadgeDollarSign, BarChart3, BriefcaseBusiness,
  Building2, CalendarDays, CheckSquare, ChevronRight, CircleDollarSign, DatabaseBackup,
  Crown, Download, FileKey2, FileText, Globe2, ImageIcon, KeyRound, LogOut, Mail, Menu, Pencil, Phone,
  Plus, RefreshCw, RotateCcw, Search, Settings, ShieldCheck, Trash2, Upload, Users, X,
} from "lucide-react";
import { SIDEBAR_LOGO_IMAGE } from "@/lib/sidebar-logo-image";
import { SaasAdmin } from "@/components/saas-admin";
import { SubscriptionView } from "@/components/subscription-view";
import type { Alert, AppRecord, ModuleKey, Role, SessionUser } from "@/lib/types";

type View = "dashboard" | "saas" | "subscription" | "clients" | "accesses" | "finance" | "tasks" | "renewals" | "crm" | "team" | "monitor" | "settings";
type Field = { key: string; label: string; type?: "text" | "number" | "date" | "textarea" | "select" | "checkbox" | "client" | "products" | "url" | "email" | "image" | "document"; options?: string[]; required?: boolean; full?: boolean; hint?: string };
type Config = { singular: string; title: string; fields: Field[]; columns: { key: string; label: string; format?: "money" | "badge" | "client" | "boolean" | "date" }[]; defaults: Record<string, unknown> };
type StatePayload = { records: AppRecord[]; alerts: Alert[]; settings: Record<string, unknown>; user: SessionUser; generatedAt: string };
type ManagedUser = { id: string; name: string; email: string; role: Role; active: boolean; mustChangePassword: boolean };

const configs: Record<ModuleKey, Config> = {
  clients: {
    singular: "cliente", title: "Clientes 360°",
    fields: [
      { key: "logoDataUrl", label: "Logo do cliente", type: "image", full: true, hint: "PNG, JPG ou WebP, até 1,5 MB." },
      { key: "name", label: "Nome do cliente", required: true }, { key: "document", label: "CPF/CNPJ" },
      { key: "segment", label: "Segmento / mercado" }, { key: "website", label: "Site", type: "url" },
      { key: "contact", label: "Contato principal" }, { key: "contactRole", label: "Cargo do contato" },
      { key: "contactEmail", label: "E-mail do contato", type: "email" }, { key: "contactPhone", label: "Telefone / WhatsApp" },
      { key: "instagram", label: "Instagram / rede principal" }, { key: "contractType", label: "Modelo de atendimento", type: "select", options: ["Mensalidade fixa", "Projeto", "Consultoria", "Permuta"] },
      { key: "contractFile", label: "Contrato do cliente", type: "document", full: true, hint: "PDF, PNG, JPG ou WebP, até 2 MB." },
      { key: "services", label: "Serviços contratados", required: true, full: true },
      { key: "productIds", label: "Produtos contratados", type: "products", full: true },
      { key: "channels", label: "Canais sob gestão", hint: "Ex.: Instagram, Google Ads, LinkedIn, e-mail." },
      { key: "contentPillars", label: "Pilares de conteúdo" },
      { key: "goals", label: "Objetivos e metas do cliente", type: "textarea", full: true },
      { key: "scope", label: "Escopo e entregas recorrentes", type: "textarea", full: true },
      { key: "monthly", label: "Mensalidade", type: "number" }, { key: "dueDay", label: "Dia do vencimento", type: "number" },
      { key: "startDate", label: "Início", type: "date" }, { key: "renewal", label: "Renovação", type: "date" },
      { key: "noticeDays", label: "Aviso prévio (dias)", type: "number" }, { key: "responsible", label: "Responsável DOCTYPE" },
      { key: "health", label: "Saúde", type: "select", options: ["Saudável", "Atenção", "Risco"] }, { key: "status", label: "Status", type: "select", options: ["Ativo", "Pausado", "Encerrado"] },
      { key: "observations", label: "Observações", type: "textarea", full: true },
    ],
    columns: [{ key: "name", label: "Cliente" }, { key: "services", label: "Serviços" }, { key: "monthly", label: "Mensalidade", format: "money" }, { key: "renewal", label: "Renovação", format: "date" }, { key: "health", label: "Saúde", format: "badge" }, { key: "status", label: "Status", format: "badge" }],
    defaults: { logoDataUrl: "", contractFile: { name: "", dataUrl: "" }, productIds: [], contractType: "Mensalidade fixa", monthly: 0, dueDay: 10, noticeDays: 30, health: "Saudável", status: "Ativo" },
  },
  accesses: {
    singular: "acesso", title: "Acessos dos clientes",
    fields: [
      { key: "clientId", label: "Cliente", type: "client", required: true }, { key: "platform", label: "Plataforma/rede", required: true },
      { key: "login", label: "Login/e-mail" }, { key: "user", label: "Usuário/ID" }, { key: "url", label: "URL", type: "url" },
      { key: "twoFA", label: "2FA confirmado", type: "checkbox" }, { key: "responsible", label: "Responsável" },
      { key: "status", label: "Status", type: "select", options: ["OK", "Pendente", "Bloqueado", "Revogado"] },
      { key: "secretRef", label: "Referência segura do segredo" }, { key: "observations", label: "Observações", type: "textarea", full: true },
    ],
    columns: [{ key: "clientId", label: "Cliente", format: "client" }, { key: "platform", label: "Plataforma" }, { key: "login", label: "Login/e-mail" }, { key: "user", label: "Usuário/ID" }, { key: "twoFA", label: "2FA", format: "boolean" }, { key: "responsible", label: "Responsável" }, { key: "status", label: "Status", format: "badge" }],
    defaults: { twoFA: false, status: "OK" },
  },
  invoices: {
    singular: "fatura", title: "Receitas e faturas",
    fields: [{ key: "clientId", label: "Cliente", type: "client", required: true }, { key: "description", label: "Descrição", required: true }, { key: "value", label: "Valor", type: "number" }, { key: "due", label: "Vencimento", type: "date" }, { key: "paidAt", label: "Pagamento", type: "date" }, { key: "status", label: "Status", type: "select", options: ["Pendente", "Pago", "Vencido", "Cancelado"] }, { key: "recurring", label: "Receita recorrente", type: "checkbox" }],
    columns: [{ key: "clientId", label: "Cliente", format: "client" }, { key: "description", label: "Descrição" }, { key: "value", label: "Valor", format: "money" }, { key: "due", label: "Vencimento", format: "date" }, { key: "status", label: "Status", format: "badge" }],
    defaults: { value: 0, status: "Pendente", recurring: false },
  },
  expenses: {
    singular: "despesa", title: "Despesas",
    fields: [{ key: "name", label: "Despesa", required: true }, { key: "category", label: "Categoria" }, { key: "value", label: "Valor", type: "number" }, { key: "due", label: "Vencimento", type: "date" }, { key: "paidAt", label: "Pagamento", type: "date" }, { key: "status", label: "Status", type: "select", options: ["Previsto", "Pago", "Vencido", "Cancelado"] }, { key: "recurring", label: "Despesa recorrente", type: "checkbox" }],
    columns: [{ key: "name", label: "Despesa" }, { key: "category", label: "Categoria" }, { key: "value", label: "Valor", format: "money" }, { key: "due", label: "Vencimento", format: "date" }, { key: "status", label: "Status", format: "badge" }],
    defaults: { value: 0, status: "Previsto", recurring: false },
  },
  tasks: {
    singular: "tarefa", title: "Operação",
    fields: [{ key: "title", label: "Tarefa", required: true }, { key: "clientId", label: "Cliente", type: "client" }, { key: "responsible", label: "Responsável" }, { key: "due", label: "Prazo", type: "date" }, { key: "priority", label: "Prioridade", type: "select", options: ["Baixa", "Média", "Alta", "Crítica"] }, { key: "status", label: "Status", type: "select", options: ["Aberta", "Em andamento", "Aguardando", "Concluída"] }, { key: "description", label: "Descrição", type: "textarea", full: true }],
    columns: [{ key: "title", label: "Tarefa" }, { key: "clientId", label: "Cliente", format: "client" }, { key: "responsible", label: "Responsável" }, { key: "due", label: "Prazo", format: "date" }, { key: "priority", label: "Prioridade", format: "badge" }, { key: "status", label: "Status", format: "badge" }],
    defaults: { priority: "Média", status: "Aberta" },
  },
  crm: {
    singular: "assinatura", title: "DOC CRM",
    fields: [{ key: "clientId", label: "Cliente", type: "client", required: true }, { key: "plan", label: "Plano", type: "select", options: ["Start", "Smart", "Pro", "Legado"] }, { key: "mrr", label: "MRR", type: "number" }, { key: "setup", label: "Setup", type: "number" }, { key: "platformCost", label: "Custo da plataforma", type: "number" }, { key: "channelCost", label: "Custo dos canais", type: "number" }, { key: "status", label: "Status", type: "select", options: ["Ativo", "Pausado", "Cancelado"] }, { key: "observations", label: "Observações", type: "textarea", full: true }],
    columns: [{ key: "clientId", label: "Cliente", format: "client" }, { key: "plan", label: "Plano", format: "badge" }, { key: "mrr", label: "MRR", format: "money" }, { key: "setup", label: "Setup", format: "money" }, { key: "platformCost", label: "Plataforma", format: "money" }, { key: "channelCost", label: "Canais", format: "money" }, { key: "status", label: "Status", format: "badge" }],
    defaults: { plan: "Smart", mrr: 0, setup: 0, platformCost: 0, channelCost: 0, status: "Ativo" },
  },
  team: {
    singular: "integrante", title: "Equipe",
    fields: [{ key: "name", label: "Nome", required: true }, { key: "role", label: "Papel", required: true }, { key: "email", label: "E-mail", type: "email" }, { key: "cost", label: "Custo mensal", type: "number" }, { key: "status", label: "Status", type: "select", options: ["Ativo", "Inativo"] }, { key: "responsibilities", label: "Responsabilidades", type: "textarea", full: true }],
    columns: [{ key: "name", label: "Nome" }, { key: "role", label: "Papel" }, { key: "cost", label: "Custo", format: "money" }, { key: "status", label: "Status", format: "badge" }, { key: "responsibilities", label: "Responsabilidades" }],
    defaults: { cost: 0, status: "Ativo" },
  },
};

const nav: { id: View; label: string; icon: typeof BarChart3; roles?: Role[]; masterOnly?: boolean }[] = [
  { id: "dashboard", label: "Visão Geral", icon: BarChart3 }, { id: "saas", label: "Admin SaaS", icon: Crown, roles: ["CEO_ADMIN"], masterOnly: true }, { id: "subscription", label: "Minha assinatura", icon: BadgeDollarSign, roles: ["CEO_ADMIN"] }, { id: "clients", label: "Clientes 360°", icon: BriefcaseBusiness },
  { id: "accesses", label: "Acessos", icon: FileKey2, roles: ["CEO_ADMIN", "OPERATIONS"] }, { id: "finance", label: "Financeiro", icon: CircleDollarSign, roles: ["CEO_ADMIN", "FINANCE"] },
  { id: "tasks", label: "Operação", icon: CheckSquare, roles: ["CEO_ADMIN", "OPERATIONS"] }, { id: "renewals", label: "Renovações", icon: RotateCcw },
  { id: "crm", label: "DOC CRM", icon: Activity }, { id: "team", label: "Equipe", icon: Users, roles: ["CEO_ADMIN", "OPERATIONS"] },
  { id: "monitor", label: "DOC Monitor", icon: ShieldCheck }, { id: "settings", label: "Configurações", icon: Settings, roles: ["CEO_ADMIN"] },
];

const titles: Record<View, string> = Object.fromEntries(nav.map((n) => [n.id, n.label])) as Record<View, string>;
const money = (value: unknown) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (value: unknown) => value ? new Date(`${String(value)}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const number = (value: unknown) => Number(value || 0);
const text = (value: unknown) => String(value ?? "");
const stringArray = (value: unknown) => Array.isArray(value) ? value.map(String) : [];
const storedDocument = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { name: "", dataUrl: "" };
  const file = value as Record<string, unknown>;
  return { name: text(file.name), dataUrl: text(file.dataUrl) };
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("Sessão expirada. Entre novamente.");
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir a operação.");
  return body;
}

export function DoctypeOS({ initialState }: { initialState: StatePayload }) {
  const router = useRouter();
  const [view, setView] = useState<View>("dashboard");
  const [state, setState] = useState<StatePayload>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ module: ModuleKey; record?: AppRecord } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ module: ModuleKey; record: AppRecord } | null>(null);
  const [accountPassword, setAccountPassword] = useState(false);
  const [toast, setToast] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); setError("");
    try { setState(await api<StatePayload>("/api/state")); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar os dados."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const syncRecords = () => { void refresh(true); };
    window.addEventListener("doctype:records-changed", syncRecords);
    return () => window.removeEventListener("doctype:records-changed", syncRecords);
  }, [refresh]);

  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 3500); return () => clearTimeout(timer); }, [toast]);

  const user = state.user;
  const records = state.records;
  const clients = records.filter((r) => r.module === "clients");
  const products = records.filter((r) => r.module === "products");
  const clientName = (id: unknown) => text(clients.find((c) => c.id === id)?.data.name) || "—";
  const byModule = (module: ModuleKey) => records.filter((r) => r.module === module);

  function openView(next: View) { setView(next); setSearch(""); setMenuOpen(false); }
  function notify(message: string) { setToast(message); }

  async function saveRecord(module: ModuleKey, data: Record<string, unknown>, id?: string, expectedUpdatedAt?: string) {
    await api(id ? `/api/records/${id}` : "/api/records", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module, data, expectedUpdatedAt }) });
    setModal(null); notify(id ? "Registro atualizado." : "Registro criado."); await refresh(true);
  }

  async function removeRecord() {
    if (!confirmDelete) return;
    await api(`/api/records/${confirmDelete.record.id}?module=${confirmDelete.module}`, { method: "DELETE" });
    setConfirmDelete(null); notify("Registro excluído."); await refresh(true);
  }

  async function logout() { await api("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }
  async function downloadBackup() {
    const response = await fetch("/api/backup");
    if (!response.ok) { const body = await response.json(); throw new Error(body.error); }
    const blob = await response.blob(); const href = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = href; anchor.download = `DOCTYPE_OS_${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(href); notify("Backup exportado.");
  }
  async function restoreBackup(file: File) {
    const content = JSON.parse(await file.text());
    if (!window.confirm("Esta restauração substituirá todos os dados atuais. Deseja continuar?")) return;
    await api("/api/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) });
    notify("Backup restaurado."); await refresh(true);
  }

  const filtered = (module: ModuleKey) => byModule(module).filter((record) => JSON.stringify(record.data).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="os-shell">
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <button className="mobile-close" aria-label="Fechar menu" onClick={() => setMenuOpen(false)}><X /></button>
        <div className="brand"><Image src={SIDEBAR_LOGO_IMAGE} alt="Símbolo DOCTYPE" width={58} height={58} priority unoptimized /><div><strong>DOCTYPE OS</strong><span>Gestão interna</span></div></div>
        <nav>{nav.filter((item) => (!item.roles || item.roles.includes(user.role)) && (!item.masterOnly || user.isSaasMaster)).map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => openView(item.id)}><item.icon size={18} /><span>{item.label}</span>{item.id === "monitor" && state?.alerts.length ? <b className="nav-count">{state.alerts.length}</b> : null}</button>)}</nav>
        <div className="sidebar-user"><span>{user.name}</span><small>{user.role === "CEO_ADMIN" ? "CEO / Admin" : user.role === "FINANCE" ? "Financeiro" : "Operação"}</small><button onClick={() => setAccountPassword(true)}><KeyRound size={15} /> Alterar minha senha</button><button onClick={logout}><LogOut size={15} /> Sair com segurança</button></div>
        <footer>Mais que marketing.<br /><strong>Estrutura para crescer.</strong></footer>
      </aside>
      {menuOpen && <button className="sidebar-overlay" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />}
      <main className="workspace">
        <header className="topbar"><button className="menu-button" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}><Menu /></button><div><h1>{titles[view]}</h1><p>Marketing • CRM • Inteligência Artificial</p></div><div className="top-actions"><button className="ghost icon-button" aria-label="Atualizar dados" onClick={() => refresh()}><RefreshCw size={17} /></button>{user.role === "CEO_ADMIN" && <button className="ghost backup-top" onClick={() => downloadBackup().catch((e) => setError(e.message))}><DatabaseBackup size={17} /> Backup</button>}{user.role !== "FINANCE" && view !== "saas" && <button className="primary new-top" onClick={() => setModal({ module: "clients" })}><Plus size={17} /> Cliente</button>}</div></header>
        <section className="content">
          {loading ? <LoadingState /> : error ? <ErrorState error={error} retry={() => refresh()} /> : (
            <>
              {user.mustChangePassword && <div className="security-banner"><KeyRound size={20} /><div><strong>Troque a senha provisória.</strong><span>Crie uma senha pessoal para proteger seu acesso.</span></div><button onClick={() => setAccountPassword(true)}>Trocar agora</button></div>}
              {view === "dashboard" && <Dashboard records={records} alerts={state.alerts} openView={openView} clientName={clientName} role={user.role} />}
              {view === "saas" && user.isSaasMaster && <SaasAdmin notify={notify} />}
              {view === "subscription" && user.role === "CEO_ADMIN" && <SubscriptionView />}
              {view === "clients" && <ClientsView records={clients} search={search} setSearch={setSearch} generatedAt={state.generatedAt} onAdd={() => setModal({ module: "clients" })} onEdit={(record) => setModal({ module: "clients", record })} onDelete={(record) => setConfirmDelete({ module: "clients", record })} />}
              {view === "accesses" && <><div className="notice"><ShieldCheck size={20} /><div><strong>Segurança primeiro.</strong><span>Nunca informe senhas aqui. Guarde somente a referência ao cofre seguro.</span></div></div><ModuleView module="accesses" records={filtered("accesses")} search={search} setSearch={setSearch} clientName={clientName} onAdd={() => setModal({ module: "accesses" })} onEdit={(record) => setModal({ module: "accesses", record })} onDelete={(record) => setConfirmDelete({ module: "accesses", record })} /></>}
              {view === "finance" && <FinanceView invoices={filtered("invoices")} expenses={filtered("expenses")} search={search} setSearch={setSearch} clientName={clientName} setModal={setModal} setConfirmDelete={setConfirmDelete} />}
              {view === "tasks" && <ModuleView module="tasks" records={filtered("tasks")} search={search} setSearch={setSearch} clientName={clientName} onAdd={() => setModal({ module: "tasks" })} onEdit={(record) => setModal({ module: "tasks", record })} onDelete={(record) => setConfirmDelete({ module: "tasks", record })} />}
              {view === "renewals" && <Renewals clients={clients} generatedAt={state.generatedAt} onEdit={(record) => setModal({ module: "clients", record })} />}
              {view === "crm" && <CrmView records={filtered("crm")} search={search} setSearch={setSearch} clientName={clientName} goal={number(state.settings.crmGoal)} onAdd={() => setModal({ module: "crm" })} onEdit={(record) => setModal({ module: "crm", record })} onDelete={(record) => setConfirmDelete({ module: "crm", record })} />}
              {view === "team" && <ModuleView module="team" records={filtered("team")} search={search} setSearch={setSearch} clientName={clientName} onAdd={() => setModal({ module: "team" })} onEdit={(record) => setModal({ module: "team", record })} onDelete={(record) => setConfirmDelete({ module: "team", record })} />}
              {view === "monitor" && <Monitor alerts={state.alerts} openView={openView} />}
              {view === "settings" && <SettingsView goal={number(state.settings.crmGoal)} onSaved={() => refresh(true)} downloadBackup={downloadBackup} importRef={importRef} restoreBackup={restoreBackup} user={user} notify={notify} />}
            </>
          )}
        </section>
      </main>
      {modal && <RecordModal module={modal.module} record={modal.record} clients={clients} products={products} close={() => setModal(null)} save={saveRecord} />}
      {confirmDelete && <ConfirmModal title="Excluir registro?" text={confirmDelete.module === "clients" ? "Esta ação removerá o cliente e os acessos, faturas, tarefas, assinaturas, orçamentos e contratos vinculados. A exclusão ficará registrada na auditoria." : `Esta ação removerá ${configs[confirmDelete.module].singular} da base compartilhada e ficará registrada na auditoria.`} close={() => setConfirmDelete(null)} confirm={removeRecord} />}
      {accountPassword && <PasswordModal close={() => setAccountPassword(false)} saved={() => { setAccountPassword(false); notify("Senha alterada com segurança."); void refresh(true); }} />}
      {toast && <div className="toast" role="status"><ShieldCheck size={18} />{toast}</div>}
    </div>
  );
}

function LoadingState() { return <div className="loading-state"><span className="spinner" /><strong>O DOC está organizando os dados…</strong></div>; }
function ErrorState({ error, retry }: { error: string; retry: () => void }) { return <div className="empty-state"><AlertTriangle /><h2>Não foi possível carregar.</h2><p>{error}</p><button className="primary" onClick={retry}>Tentar novamente</button></div>; }

function Dashboard({ records, alerts, openView, clientName, role }: { records: AppRecord[]; alerts: Alert[]; openView: (v: View) => void; clientName: (id: unknown) => string; role: Role }) {
  const clients = records.filter((r) => r.module === "clients");
  const invoices = records.filter((r) => r.module === "invoices");
  const tasks = records.filter((r) => r.module === "tasks");
  const mrr = clients.filter((r) => r.data.status === "Ativo").reduce((sum, r) => sum + number(r.data.monthly), 0);
  const receivable = invoices.filter((r) => !["Pago", "Cancelado"].includes(text(r.data.status))).reduce((sum, r) => sum + number(r.data.value), 0);
  const overdue = invoices.filter((r) => !["Pago", "Cancelado"].includes(text(r.data.status)) && text(r.data.due) < new Date().toISOString().slice(0, 10)).reduce((sum, r) => sum + number(r.data.value), 0);
  const openTasks = tasks.filter((r) => r.data.status !== "Concluída").length;
  return <div className="stack">
    <div className="kpi-grid"><Kpi label="MRR clientes" value={money(mrr)} meta="Contratos ativos" /><Kpi label="A receber" value={money(receivable)} meta={`${invoices.filter((r) => r.data.status !== "Pago").length} lançamentos`} /><Kpi label="Inadimplência" value={money(overdue)} meta={overdue ? "Requer atenção" : "Tudo em dia"} danger={overdue > 0} /><Kpi label="Clientes ativos" value={String(clients.filter((r) => r.data.status === "Ativo").length)} meta={`${openTasks} tarefas abertas`} /></div>
    <div className="dashboard-grid">
      <section className="card"><SectionTitle title="Operação agora" subtitle="Visão gerencial dos principais módulos" /><div className="quick-grid">{role !== "FINANCE" ? <><Quick label="Tarefas abertas" value={openTasks} onClick={() => openView("tasks")} /><Quick label="Acessos cadastrados" value={records.filter((r) => r.module === "accesses").length} onClick={() => openView("accesses")} /></> : <Quick label="Faturas cadastradas" value={invoices.length} onClick={() => openView("finance")} />}<Quick label="Assinaturas DOC CRM" value={records.filter((r) => r.module === "crm" && r.data.status === "Ativo").length} onClick={() => openView("crm")} /><Quick label="Renovações" value={clients.filter((r) => r.data.renewal).length} onClick={() => openView("renewals")} /></div>
        <h3 className="subheading">Próximas tarefas</h3><CompactTable rows={tasks.filter((r) => r.data.status !== "Concluída").slice(0, 5).map((r) => [text(r.data.title), clientName(r.data.clientId), dateLabel(r.data.due), <Badge key={r.id} value={text(r.data.priority)} />])} headers={["Tarefa", "Cliente", "Prazo", "Prioridade"]} />
      </section>
      <DocCard alerts={alerts.slice(0, 6)} openView={openView} />
    </div>
  </div>;
}

function Kpi({ label, value, meta, danger }: { label: string; value: string; meta: string; danger?: boolean }) { return <article className={`kpi-card ${danger ? "danger-kpi" : ""}`}><span>{label}</span><strong>{value}</strong><small>{meta}</small></article>; }
function Quick({ label, value, onClick }: { label: string; value: number; onClick: () => void }) { return <button className="quick" onClick={onClick}><div><span>{label}</span><strong>{value}</strong></div><ChevronRight /></button>; }
function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) { return <div className="section-title"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>; }

function ClientsView({ records, search, setSearch, generatedAt, onAdd, onEdit, onDelete }: { records: AppRecord[]; search: string; setSearch: (v: string) => void; generatedAt: string; onAdd: () => void; onEdit: (r: AppRecord) => void; onDelete: (r: AppRecord) => void }) {
  const visible = records.filter((record) => JSON.stringify(record.data).toLowerCase().includes(search.toLowerCase()));
  const active = records.filter((record) => record.data.status === "Ativo");
  const mrr = active.reduce((sum, record) => sum + number(record.data.monthly), 0);
  const attention = active.filter((record) => record.data.health === "Atenção" || record.data.health === "Risco").length;
  const baseDate = new Date(generatedAt).getTime();
  const renewals = active.filter((record) => {
    if (!record.data.renewal) return false;
    const days = Math.ceil((new Date(`${text(record.data.renewal)}T12:00:00`).getTime() - baseDate) / 86400000);
    return days >= 0 && days <= 30;
  }).length;

  return <section className="stack clients-workspace">
    <div className="clients-hero">
      <div><span>CARTEIRA DE CLIENTES</span><h2>Clientes, contratos e contexto em um só lugar.</h2><p>Centralize marcas, contatos, escopo, canais, metas e informações dos clientes recorrentes.</p></div>
      <button className="primary" onClick={onAdd}><Plus size={17} /> Novo cliente</button>
    </div>
    <div className="client-kpis">
      <Kpi label="Clientes ativos" value={String(active.length)} meta={`${records.length} na carteira`} />
      <Kpi label="MRR da carteira" value={money(mrr)} meta="Mensalidades ativas" />
      <Kpi label="Pedem atenção" value={String(attention)} meta="Saúde em atenção ou risco" danger={attention > 0} />
      <Kpi label="Renovam em 30 dias" value={String(renewals)} meta="Contratos ativos" />
    </div>
    <div className="clients-toolbar"><SearchBox value={search} setValue={setSearch} /><span>{visible.length} cliente{visible.length === 1 ? "" : "s"}</span></div>
    {visible.length ? <div className="client-grid" role="table" aria-label="Carteira de clientes">{visible.map((record) => <ClientCard key={record.id} record={record} onEdit={onEdit} onDelete={onDelete} />)}</div> : <div className="empty-state"><Building2 /><h3>Nenhum cliente encontrado.</h3><p>{search ? "Tente buscar por outro nome, serviço ou contato." : "Cadastre o primeiro cliente fixo da agência."}</p>{!search && <button className="primary" onClick={onAdd}><Plus size={17} /> Novo cliente</button>}</div>}
  </section>;
}

function ClientCard({ record, onEdit, onDelete }: { record: AppRecord; onEdit: (r: AppRecord) => void; onDelete: (r: AppRecord) => void }) {
  const data = record.data;
  const logo = text(data.logoDataUrl);
  const contract = storedDocument(data.contractFile);
  const initials = text(data.name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CL";
  return <article className="client-card" role="row" aria-label={text(data.name)}>
    <div className="client-card-head">
      <div className="client-logo">{logo.startsWith("data:image/") ? <Image src={logo} alt={`Logo de ${text(data.name)}`} width={72} height={72} unoptimized /> : <span>{initials}</span>}</div>
      <div className="client-identity"><div><Badge value={text(data.status)} /><Badge value={text(data.health)} /></div><h3>{text(data.name)}</h3><p>{text(data.segment) || text(data.services) || "Segmento não informado"}</p></div>
      <div className="client-card-actions"><button aria-label="Editar cliente" onClick={() => onEdit(record)}><Pencil size={16} /></button><button className="delete" aria-label="Excluir cliente" onClick={() => onDelete(record)}><Trash2 size={16} /></button></div>
    </div>
    <div className="client-contract-strip"><div><BadgeDollarSign /><span>Mensalidade<strong>{money(data.monthly)}</strong></span></div><div><CalendarDays /><span>Renovação<strong>{dateLabel(data.renewal)}</strong></span></div></div>
    <div className="client-details">
      <p><BriefcaseBusiness /><span><b>Serviços</b>{text(data.services) || "Não informados"}</span></p>
      <p><Users /><span><b>Responsável</b>{text(data.responsible) || "Não definido"}</span></p>
      <p><Phone /><span><b>Contato</b>{text(data.contact) || text(data.contactPhone) || "Não informado"}</span></p>
      <p><Mail /><span><b>E-mail</b>{text(data.contactEmail) || "Não informado"}</span></p>
    </div>
    {Boolean(data.website || data.instagram || data.channels) && <div className="client-foot"><Globe2 /> <span>{text(data.website || data.instagram || data.channels)}</span></div>}
    {contract.dataUrl && <a className="client-contract-download" href={contract.dataUrl} download={contract.name || "contrato-do-cliente.pdf"}><FileText /><span><b>Contrato salvo</b>{contract.name || "Baixar documento"}</span><Download /></a>}
  </article>;
}

function ModuleView({ module, records, search, setSearch, clientName, onAdd, onEdit, onDelete }: { module: ModuleKey; records: AppRecord[]; search: string; setSearch: (v: string) => void; clientName: (id: unknown) => string; onAdd: () => void; onEdit: (r: AppRecord) => void; onDelete: (r: AppRecord) => void }) {
  const config = configs[module];
  const article = ["fatura", "despesa", "tarefa", "assinatura"].includes(config.singular) ? "Nova" : "Novo";
  return <section className="stack"><SectionTitle title={config.title} subtitle={`${records.length} registro${records.length === 1 ? "" : "s"} na base compartilhada`} action={<button className="primary" onClick={onAdd}><Plus size={17} /> {article} {config.singular}</button>} /><SearchBox value={search} setValue={setSearch} /><DataTable config={config} records={records} clientName={clientName} onEdit={onEdit} onDelete={onDelete} /></section>;
}

function SearchBox({ value, setValue }: { value: string; setValue: (v: string) => void }) { return <label className="search-box"><Search size={18} /><input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Buscar em todos os campos…" /><span>{value && <button aria-label="Limpar busca" onClick={() => setValue("")}><X size={16} /></button>}</span></label>; }

function DataTable({ config, records, clientName, onEdit, onDelete }: { config: Config; records: AppRecord[]; clientName: (id: unknown) => string; onEdit: (r: AppRecord) => void; onDelete: (r: AppRecord) => void }) {
  if (!records.length) return <div className="empty-state compact"><ArchiveRestore /><h3>Nenhum registro encontrado.</h3><p>Use o botão acima para cadastrar o primeiro.</p></div>;
  return <div className="table-wrap"><table><thead><tr>{config.columns.map((c) => <th key={c.key}>{c.label}</th>)}<th className="actions-col">Ações</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}>{config.columns.map((column) => <td key={column.key}>{formatCell(record.data[column.key], column.format, clientName)}</td>)}<td className="row-actions"><button aria-label={`Editar ${config.singular}`} onClick={() => onEdit(record)}><Pencil size={16} /></button><button className="delete" aria-label={`Excluir ${config.singular}`} onClick={() => onDelete(record)}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>;
}

function formatCell(value: unknown, format: Config["columns"][number]["format"], clientName: (id: unknown) => string) {
  if (format === "money") return money(value); if (format === "date") return dateLabel(value); if (format === "badge") return <Badge value={text(value)} />; if (format === "client") return clientName(value); if (format === "boolean") return <Badge value={value ? "Ativo" : "Pendente"} />; return text(value) || "—";
}
function Badge({ value }: { value: string }) { const style = /pago|ativo|saud|ok|conclu/i.test(value) ? "success" : /venc|risco|bloq|cancel|crítica/i.test(value) ? "danger" : /pend|aten|alta|aberta|andamento/i.test(value) ? "warning" : "info"; return <span className={`badge ${style}`}>{value || "—"}</span>; }

function FinanceView({ invoices, expenses, search, setSearch, clientName, setModal, setConfirmDelete }: { invoices: AppRecord[]; expenses: AppRecord[]; search: string; setSearch: (v: string) => void; clientName: (id: unknown) => string; setModal: (v: { module: ModuleKey; record?: AppRecord }) => void; setConfirmDelete: (v: { module: ModuleKey; record: AppRecord }) => void }) {
  const income = invoices.filter((r) => r.data.status === "Pago").reduce((s, r) => s + number(r.data.value), 0);
  const cost = expenses.filter((r) => r.data.status === "Pago").reduce((s, r) => s + number(r.data.value), 0);
  return <div className="stack"><div className="kpi-grid finance-kpis"><Kpi label="Recebido" value={money(income)} meta="Faturas pagas" /><Kpi label="Despesas pagas" value={money(cost)} meta="Custos realizados" /><Kpi label="Resultado" value={money(income - cost)} meta="Recebido menos despesas" danger={income - cost < 0} /></div><SearchBox value={search} setValue={setSearch} /><section><SectionTitle title="Receitas e faturas" action={<button className="primary" onClick={() => setModal({ module: "invoices" })}><Plus size={17} /> Nova fatura</button>} /><DataTable config={configs.invoices} records={invoices} clientName={clientName} onEdit={(record) => setModal({ module: "invoices", record })} onDelete={(record) => setConfirmDelete({ module: "invoices", record })} /></section><section><SectionTitle title="Despesas" action={<button className="secondary" onClick={() => setModal({ module: "expenses" })}><Plus size={17} /> Nova despesa</button>} /><DataTable config={configs.expenses} records={expenses} clientName={clientName} onEdit={(record) => setModal({ module: "expenses", record })} onDelete={(record) => setConfirmDelete({ module: "expenses", record })} /></section></div>;
}

function Renewals({ clients, generatedAt, onEdit }: { clients: AppRecord[]; generatedAt: string; onEdit: (r: AppRecord) => void }) {
  const rows = clients.filter((c) => c.data.renewal).sort((a, b) => text(a.data.renewal).localeCompare(text(b.data.renewal)));
  return <div className="stack"><div className="notice"><RotateCcw size={20} /><div><strong>Régua automática de renovação.</strong><span>O DOC alerta nos marcos D-30, D-15, D-7 e D0.</span></div></div><SectionTitle title="Calendário de renovações" subtitle={`${rows.length} contrato${rows.length === 1 ? "" : "s"} com data definida`} />{rows.length ? <div className="renewal-grid">{rows.map((record) => { const days = Math.ceil((new Date(`${text(record.data.renewal)}T12:00:00`).getTime() - new Date(generatedAt).getTime()) / 86400000); return <article className="renewal-card" key={record.id}><span className={days < 0 ? "late" : days <= 30 ? "soon" : ""}>{days < 0 ? `${Math.abs(days)} dias atrasado` : days === 0 ? "D0" : `D-${days}`}</span><h3>{text(record.data.name)}</h3><p>{dateLabel(record.data.renewal)} · {text(record.data.responsible) || "Sem responsável"}</p><button className="ghost" onClick={() => onEdit(record)}><Pencil size={15} /> Editar contrato</button></article>; })}</div> : <div className="empty-state"><RotateCcw /><h3>Nenhuma renovação cadastrada.</h3><p>Adicione a data no cadastro do cliente.</p></div>}</div>;
}

function CrmView(props: { records: AppRecord[]; search: string; setSearch: (v: string) => void; clientName: (id: unknown) => string; goal: number; onAdd: () => void; onEdit: (r: AppRecord) => void; onDelete: (r: AppRecord) => void }) {
  const active = props.records.filter((r) => r.data.status === "Ativo"); const mrr = active.reduce((s, r) => s + number(r.data.mrr), 0); const costs = active.reduce((s, r) => s + number(r.data.platformCost) + number(r.data.channelCost), 0); const progress = props.goal ? Math.min(100, (mrr / props.goal) * 100) : 0;
  return <div className="stack"><div className="kpi-grid finance-kpis"><Kpi label="MRR DOC CRM" value={money(mrr)} meta={`${active.length} assinaturas ativas`} /><Kpi label="Custos recorrentes" value={money(costs)} meta="Plataforma + canais" /><Kpi label="Margem gerencial" value={money(mrr - costs)} meta={mrr ? `${Math.round(((mrr - costs) / mrr) * 100)}% de margem` : "Sem receita"} /></div><section className="card goal-card"><div><span>Meta de MRR</span><strong>{money(props.goal)}</strong></div><div className="progress"><i style={{ width: `${progress}%` }} /></div><b>{Math.round(progress)}%</b></section><ModuleView module="crm" records={props.records} search={props.search} setSearch={props.setSearch} clientName={props.clientName} onAdd={props.onAdd} onEdit={props.onEdit} onDelete={props.onDelete} /></div>;
}

function Monitor({ alerts, openView }: { alerts: Alert[]; openView: (v: View) => void }) { return <div className="monitor-layout"><DocCard alerts={alerts} openView={openView} large /><section className="card"><SectionTitle title="Como o Guardião atua" subtitle="Exceções reais, priorizadas por impacto" /><div className="monitor-principles"><div><ShieldCheck /><strong>Observa</strong><span>Analisa vencimentos, prazos, segurança e saúde dos clientes.</span></div><div><AlertTriangle /><strong>Orienta</strong><span>Mostra o que exige decisão e leva diretamente ao módulo responsável.</span></div><div><CheckSquare /><strong>Registra</strong><span>Todas as alterações importantes ficam no log de auditoria.</span></div></div></section></div>; }

function DocCard({ alerts, openView, large }: { alerts: Alert[]; openView: (v: View) => void; large?: boolean }) { return <section className={`doc-card ${large ? "large" : ""}`}><Image src="/assets/doc-mascote.svg" alt="DOC Monitor" width={large ? 190 : 125} height={large ? 190 : 125} /><div className="doc-copy"><span className="eyebrow">DOC MONITOR</span><h2>{alerts.length ? `${alerts.length} ponto${alerts.length === 1 ? "" : "s"} pedem atenção.` : "A operação está protegida."}</h2><p>O Guardião observa exceções para a equipe agir antes que virem problemas.</p><div className="alert-list">{alerts.length ? alerts.map((alert) => <button key={alert.id} onClick={() => openView((alert.module === "finance" ? "finance" : alert.module) as View)}><i className={alert.severity} /><span><strong>{alert.title}</strong><small>{alert.detail}</small></span><ChevronRight /></button>) : <div className="all-clear"><ShieldCheck /> Sem alertas críticos neste momento.</div>}</div></div></section>; }

function SettingsView({ goal, onSaved, downloadBackup, importRef, restoreBackup, user, notify }: { goal: number; onSaved: () => void; downloadBackup: () => Promise<void>; importRef: React.RefObject<HTMLInputElement | null>; restoreBackup: (file: File) => Promise<void>; user: SessionUser; notify: (m: string) => void }) {
  const [crmGoal, setCrmGoal] = useState(goal); const [users, setUsers] = useState<ManagedUser[]>([]); const [usersError, setUsersError] = useState(""); const [userModal, setUserModal] = useState<ManagedUser | "new" | null>(null); const [passwordModal, setPasswordModal] = useState(false);
  const loadUsers = useCallback(async () => { try { setUsers((await api<{ users: ManagedUser[] }>("/api/users")).users); } catch (e) { setUsersError(e instanceof Error ? e.message : "Erro ao carregar usuários."); } }, []);
  useEffect(() => {
    let active = true;
    api<{ users: ManagedUser[] }>("/api/users").then((payload) => { if (active) setUsers(payload.users); }).catch((cause) => { if (active) setUsersError(cause instanceof Error ? cause.message : "Erro ao carregar usuários."); });
    return () => { active = false; };
  }, []);
  async function saveGoal() { await api("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crmGoal }) }); notify("Meta atualizada."); onSaved(); }
  return <div className="settings-grid"><section className="card"><SectionTitle title="Meta DOC CRM" subtitle="Objetivo gerencial de receita recorrente" /><label className="field"><span>MRR desejado</span><input type="number" min="0" value={crmGoal} onChange={(e) => setCrmGoal(Number(e.target.value))} /></label><button className="primary" onClick={() => saveGoal().catch((e) => setUsersError(e.message))}>Salvar meta</button></section><section className="card"><SectionTitle title="Backup e restauração" subtitle="Cópia completa dos dados operacionais" /><div className="button-stack"><button className="secondary" onClick={() => downloadBackup().catch((e) => setUsersError(e.message))}><Download size={17} /> Exportar backup JSON</button><button className="ghost" onClick={() => importRef.current?.click()}><ArchiveRestore size={17} /> Restaurar backup</button><input ref={importRef} hidden type="file" accept="application/json" onChange={(e) => { const file = e.target.files?.[0]; if (file) restoreBackup(file).catch((err) => setUsersError(err.message)); e.target.value = ""; }} /></div></section><section className="card full-card"><SectionTitle title="Usuários e permissões" subtitle="Acesso separado por função" action={<button className="primary" onClick={() => setUserModal("new")}><Plus size={17} /> Novo usuário</button>} />{usersError && <div className="form-error">{usersError}</div>}<CompactTable headers={["Nome", "E-mail", "Permissão", "Status", "Ação"]} rows={users.map((managed) => [managed.name, managed.email, managed.role === "CEO_ADMIN" ? "CEO / Admin" : managed.role === "FINANCE" ? "Financeiro" : "Operação", <Badge key={`b-${managed.id}`} value={managed.active ? "Ativo" : "Inativo"} />, <button key={`e-${managed.id}`} className="table-action" onClick={() => setUserModal(managed)}><Pencil size={15} /> Editar</button>])} /></section><section className="card full-card"><SectionTitle title="Segurança da conta" subtitle={`Sessão atual: ${user.email}`} /><button className="ghost" onClick={() => setPasswordModal(true)}><KeyRound size={17} /> Alterar minha senha</button></section>{userModal && <UserModal value={userModal} close={() => setUserModal(null)} saved={async () => { setUserModal(null); notify("Usuário salvo."); await loadUsers(); }} />}{passwordModal && <PasswordModal close={() => setPasswordModal(false)} saved={() => { setPasswordModal(false); notify("Senha alterada com segurança."); }} />}</div>;
}

function RecordModal({ module, record, clients, products, close, save }: { module: ModuleKey; record?: AppRecord; clients: AppRecord[]; products: AppRecord[]; close: () => void; save: (module: ModuleKey, data: Record<string, unknown>, id?: string, expectedUpdatedAt?: string) => Promise<void> }) {
  const config = configs[module]; const [data, setData] = useState<Record<string, unknown>>({ ...config.defaults, ...(record?.data || {}) }); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const article = ["fatura", "despesa", "tarefa", "assinatura"].includes(config.singular) ? "Nova" : "Novo";
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { await save(module, data, record?.id, record?.updatedAt); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); setBusy(false); } }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><span className="eyebrow">BASE COMPARTILHADA</span><h2 id="modal-title">{record ? "Editar" : article} {config.singular}</h2></div><button aria-label="Fechar" onClick={close}><X /></button></div><form onSubmit={submit}><div className="form-grid">{config.fields.map((field) => <FieldControl key={field.key} field={field} value={data[field.key]} clients={clients} products={products} setValue={(value) => setData((current) => ({ ...current, [field.key]: value }))} />)}</div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="ghost" onClick={close}>Cancelar</button><button className="primary" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button></div></form></div></div>;
}

function FieldControl({ field, value, clients, products, setValue }: { field: Field; value: unknown; clients: AppRecord[]; products: AppRecord[]; setValue: (v: unknown) => void }) {
  if (field.type === "image") return <ImageUploadField field={field} value={value} setValue={setValue} />;
  if (field.type === "document") return <DocumentUploadField field={field} value={value} setValue={setValue} />;
  if (field.type === "checkbox") return <label className={`field checkbox ${field.full ? "full" : ""}`}><input type="checkbox" checked={Boolean(value)} onChange={(e) => setValue(e.target.checked)} /><span>{field.label}</span></label>;
  if (field.type === "products") {
    const selected = stringArray(value);
    return <div className={`field commercial-picker ${field.full ? "full" : ""}`}><span>{field.label}</span><div>{products.filter((product) => product.data.status === "Ativo").map((product) => { const active = selected.includes(product.id); return <button type="button" key={product.id} className={active ? "selected" : ""} onClick={() => setValue(active ? selected.filter((id) => id !== product.id) : [...selected, product.id])}><strong>{text(product.data.name)}</strong><small>{money(product.data.price)}</small></button>; })}{!products.length && <em>Cadastre um produto para vinculá-lo ao cliente.</em>}</div></div>;
  }
  return <label className={`field ${field.full ? "full" : ""}`}><span>{field.label}{field.required && " *"}</span>{field.type === "textarea" ? <textarea value={text(value)} required={field.required} onChange={(e) => setValue(e.target.value)} /> : field.type === "select" ? <select value={text(value)} required={field.required} onChange={(e) => setValue(e.target.value)}>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : field.type === "client" ? <select value={text(value)} required={field.required} onChange={(e) => setValue(e.target.value)}><option value="">Sem cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{text(client.data.name)}</option>)}</select> : <input type={field.type || "text"} step={field.type === "number" ? "0.01" : undefined} min={field.type === "number" ? "0" : undefined} value={text(value)} required={field.required} onChange={(e) => setValue(field.type === "number" ? Number(e.target.value) : e.target.value)} />}{field.hint && <small className="field-hint">{field.hint}</small>}</label>;
}

function ImageUploadField({ field, value, setValue }: { field: Field; value: unknown; setValue: (v: unknown) => void }) {
  const [error, setError] = useState("");
  const current = text(value);
  function selectLogo(file?: File) {
    setError("");
    if (!file) return;
    if (!/image\/(png|jpeg|webp)/.test(file.type)) { setError("Use uma imagem PNG, JPG ou WebP."); return; }
    if (file.size > 1_500_000) { setError("A imagem deve ter no máximo 1,5 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setValue(String(reader.result || ""));
    reader.onerror = () => setError("Não foi possível ler esta imagem.");
    reader.readAsDataURL(file);
  }
  return <div className={`field client-logo-field ${field.full ? "full" : ""}`}>
    <span>{field.label}</span>
    <div className="client-logo-uploader">
      <div className="client-logo-preview">{current.startsWith("data:image/") ? <Image src={current} alt="Prévia da logo do cliente" width={86} height={86} unoptimized /> : <ImageIcon />}</div>
      <div><label className="ghost upload-logo"><Upload size={16} /> {current ? "Trocar logo" : "Selecionar logo"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { selectLogo(event.target.files?.[0]); event.target.value = ""; }} /></label>{current && <button type="button" className="remove-logo" onClick={() => setValue("")}>Remover logo</button>}<small>{field.hint}</small>{error && <em>{error}</em>}</div>
    </div>
  </div>;
}

function DocumentUploadField({ field, value, setValue }: { field: Field; value: unknown; setValue: (v: unknown) => void }) {
  const [error, setError] = useState("");
  const current = storedDocument(value);
  function selectDocument(file?: File) {
    setError("");
    if (!file) return;
    if (!/(application\/pdf|image\/(png|jpeg|webp))/.test(file.type)) { setError("Use um arquivo PDF, PNG, JPG ou WebP."); return; }
    if (file.size > 2_000_000) { setError("O contrato deve ter no máximo 2 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setValue({ name: file.name, dataUrl: String(reader.result || "") });
    reader.onerror = () => setError("Não foi possível ler este documento.");
    reader.readAsDataURL(file);
  }
  return <div className={`field client-document-field ${field.full ? "full" : ""}`}>
    <span>{field.label}</span>
    <div className="client-document-uploader">
      <div className="client-document-icon"><FileText /></div>
      <div className="client-document-copy"><strong>{current.name || "Nenhum contrato anexado"}</strong><small>{field.hint}</small>{error && <em>{error}</em>}</div>
      <label className="ghost upload-document"><Upload size={16} /> {current.dataUrl ? "Substituir" : "Anexar contrato"}<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => { selectDocument(event.target.files?.[0]); event.target.value = ""; }} /></label>
      {current.dataUrl && <><a className="ghost preview-document" href={current.dataUrl} download={current.name || "contrato.pdf"}><Download size={16} /> Baixar</a><button type="button" className="remove-document" onClick={() => setValue({ name: "", dataUrl: "" })}>Remover</button></>}
    </div>
  </div>;
}

function ConfirmModal({ title, text: copy, close, confirm }: { title: string; text: string; close: () => void; confirm: () => Promise<void> }) { const [busy, setBusy] = useState(false); const [error, setError] = useState(""); return <div className="modal-backdrop"><div className="modal confirm-modal"><div className="danger-icon"><Trash2 /></div><h2>{title}</h2><p>{copy}</p>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button className="ghost" onClick={close}>Cancelar</button><button className="danger-button" disabled={busy} onClick={() => { setBusy(true); confirm().catch((e) => { setError(e.message); setBusy(false); }); }}>{busy ? "Excluindo…" : "Excluir"}</button></div></div></div>; }

function CompactTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) { if (!rows.length) return <div className="mini-empty">Nenhum registro.</div>; return <div className="table-wrap compact-table"><table><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>; }

function UserModal({ value, close, saved }: { value: ManagedUser | "new"; close: () => void; saved: () => Promise<void> }) { const current = value === "new" ? null : value; const [form, setForm] = useState({ name: current?.name || "", email: current?.email || "", role: current?.role || "OPERATIONS", active: current?.active ?? true, password: "" }); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(""); try { await api(current ? `/api/users/${current.id}` : "/api/users", { method: current ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); await saved(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao salvar."); setBusy(false); } } return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h2>{current ? "Editar usuário" : "Novo usuário"}</h2><button onClick={close}><X /></button></div><form onSubmit={submit}><div className="form-grid"><label className="field"><span>Nome *</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label className="field"><span>E-mail *</span><input required disabled={Boolean(current)} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label className="field"><span>Permissão *</span><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}><option value="CEO_ADMIN">CEO / Admin</option><option value="OPERATIONS">Operação</option><option value="FINANCE">Financeiro</option></select></label><label className="field"><span>{current ? "Nova senha (opcional)" : "Senha provisória *"}</span><input required={!current} minLength={10} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>{current && <label className="field checkbox full"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /><span>Usuário ativo</span></label>}</div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="ghost" onClick={close}>Cancelar</button><button className="primary" disabled={busy}>{busy ? "Salvando…" : "Salvar usuário"}</button></div></form></div></div>; }

function PasswordModal({ close, saved }: { close: () => void; saved: () => void }) { const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmation: "" }); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); async function submit(e: React.FormEvent) { e.preventDefault(); if (form.newPassword !== form.confirmation) return setError("A confirmação não coincide com a nova senha."); setBusy(true); setError(""); try { await api("/api/auth/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); saved(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao alterar senha."); setBusy(false); } } return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h2>Alterar minha senha</h2><button onClick={close}><X /></button></div><form onSubmit={submit}><div className="form-grid"><label className="field full"><span>Senha atual</span><input required type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></label><label className="field"><span>Nova senha</span><input required minLength={10} type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></label><label className="field"><span>Confirmar nova senha</span><input required minLength={10} type="password" value={form.confirmation} onChange={(e) => setForm({ ...form, confirmation: e.target.value })} /></label></div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="ghost" onClick={close}>Cancelar</button><button className="primary" disabled={busy}>{busy ? "Alterando…" : "Alterar senha"}</button></div></form></div></div>; }
