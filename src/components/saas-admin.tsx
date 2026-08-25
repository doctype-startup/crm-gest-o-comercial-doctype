"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CalendarDays, Crown, ImageIcon, Pencil, Plus, RefreshCw, Search, ShieldCheck, Upload, Users, X } from "lucide-react";

type SaasOrganization = {
  id: string; name: string; slug: string; logoDataUrl: string; plan: "Start" | "Smart" | "Pro" | "Enterprise";
  status: "Teste" | "Ativo" | "Suspenso" | "Cancelado"; maxUsers: number; renewalDate: string; notes: string;
  createdAt: string; updatedAt: string; userCount: number; activeUserCount: number; recordCount: number; adminName: string; adminEmail: string;
  monthlyPrice: number; billingCycle: "Mensal" | "Trimestral" | "Anual"; billingDay: number; billingEmail: string;
  paymentMethod: "Pix" | "Boleto" | "Cartão" | "Transferência"; paymentStatus: "Em dia" | "Pendente" | "Atrasado" | "Isento";
  nextChargeDate: string; graceUntil: string;
};

type Form = {
  name: string; slug: string; logoDataUrl: string; plan: SaasOrganization["plan"]; status: SaasOrganization["status"];
  maxUsers: number; renewalDate: string; notes: string; adminName: string; adminEmail: string; temporaryPassword: string;
  monthlyPrice: number; billingCycle: SaasOrganization["billingCycle"]; billingDay: number; billingEmail: string;
  paymentMethod: SaasOrganization["paymentMethod"]; paymentStatus: SaasOrganization["paymentStatus"]; nextChargeDate: string; graceUntil: string;
};

const blank: Form = { name: "", slug: "", logoDataUrl: "", plan: "Start", status: "Teste", maxUsers: 3, renewalDate: "", notes: "", adminName: "", adminEmail: "", temporaryPassword: "", monthlyPrice: 0, billingCycle: "Mensal", billingDay: 10, billingEmail: "", paymentMethod: "Pix", paymentStatus: "Pendente", nextChargeDate: "", graceUntil: "" };
const dateLabel = (value: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "Não definida";
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir a operação.");
  return body;
}

export function SaasAdmin({ notify }: { notify: (message: string) => void }) {
  const [organizations, setOrganizations] = useState<SaasOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<SaasOrganization | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setOrganizations((await request<{ organizations: SaasOrganization[] }>("/api/admin/organizations")).organizations); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar as empresas."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;

    request<{ organizations: SaasOrganization[] }>("/api/admin/organizations")
      .then(({ organizations: nextOrganizations }) => {
        if (active) setOrganizations(nextOrganizations);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar as empresas.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);
  const visible = useMemo(() => organizations.filter((organization) => JSON.stringify(organization).toLowerCase().includes(search.toLowerCase())), [organizations, search]);
  const active = organizations.filter((organization) => organization.status === "Ativo").length;
  const trials = organizations.filter((organization) => organization.status === "Teste").length;
  const activeUsers = organizations.reduce((sum, organization) => sum + organization.activeUserCount, 0);
  const usedSeats = organizations.reduce((sum, organization) => sum + organization.userCount, 0);
  const totalSeats = organizations.reduce((sum, organization) => sum + organization.maxUsers, 0);
  const contractedMrr = organizations.filter((organization) => ["Ativo", "Teste"].includes(organization.status)).reduce((sum, organization) => sum + organization.monthlyPrice, 0);
  const overdueAccounts = organizations.filter((organization) => organization.paymentStatus === "Atrasado").length;

  return <div className="saas-admin stack">
    <section className="saas-hero"><div><span><Crown /> CONTROLE DA PLATAFORMA</span><h2>Admin SaaS Mestre</h2><p>Provisione empresas, planos e acessos sem misturar os dados de cada operação.</p></div><button className="primary" onClick={() => setModal("new")}><Plus size={17} /> Nova empresa</button></section>
    <div className="saas-kpis"><article><span>Empresas ativas</span><strong>{active}</strong><small>{organizations.length} contas cadastradas</small></article><article><span>MRR contratado</span><strong>{money(contractedMrr)}</strong><small>Receita recorrente prevista</small></article><article><span>Cobranças atrasadas</span><strong>{overdueAccounts}</strong><small>{overdueAccounts ? "Requer acompanhamento" : "Nenhuma inadimplência"}</small></article><article><span>Em período de teste</span><strong>{trials}</strong><small>Conversões em acompanhamento</small></article><article><span>Usuários ativos</span><strong>{activeUsers}</strong><small>{usedSeats} usuários cadastrados</small></article><article><span>Licenças utilizadas</span><strong>{usedSeats}/{totalSeats}</strong><small>Capacidade contratada</small></article></div>
    <div className="saas-toolbar"><label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empresa, plano, administrador…" />{search && <button aria-label="Limpar busca" onClick={() => setSearch("")}><X /></button>}</label><button className="ghost" onClick={() => void load()}><RefreshCw /> Atualizar</button></div>
    {error && <div className="form-error">{error}</div>}
    {loading ? <div className="saas-loading"><i /> Carregando empresas SaaS…</div> : visible.length ? <div className="saas-grid">{visible.map((organization) => <OrganizationCard key={organization.id} organization={organization} edit={() => setModal(organization)} />)}</div> : <div className="empty-state"><Building2 /><h3>{search ? "Nenhuma empresa encontrada." : "Nenhuma empresa SaaS cadastrada."}</h3><p>{search ? "Tente outro termo de busca." : "Crie a primeira conta para iniciar o provisionamento."}</p>{!search && <button className="primary" onClick={() => setModal("new")}><Plus /> Nova empresa</button>}</div>}
    {modal && <OrganizationModal value={modal} close={() => setModal(null)} saved={async () => { setModal(null); notify(modal === "new" ? "Empresa SaaS criada." : "Empresa SaaS atualizada."); await load(); }} />}
  </div>;
}

function OrganizationCard({ organization, edit }: { organization: SaasOrganization; edit: () => void }) {
  const initials = organization.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SA";
  const usage = Math.min(100, organization.maxUsers ? (organization.userCount / organization.maxUsers) * 100 : 0);
  return <article className="saas-card">
    <div className="saas-card-head"><div className="saas-logo">{organization.logoDataUrl ? <Image src={organization.logoDataUrl} alt={`Logo de ${organization.name}`} width={66} height={66} unoptimized /> : <span>{initials}</span>}</div><div><span className={`saas-status ${organization.status.toLowerCase()}`}>{organization.status}</span><h3>{organization.name}</h3><p>/{organization.slug}</p></div><button aria-label={`Editar ${organization.name}`} onClick={edit}><Pencil /></button></div>
    <div className="saas-plan"><span>Plano<strong>{organization.plan} · {organization.monthlyPrice ? money(organization.monthlyPrice) : "Valor a definir"}</strong></span><span>Cobrança<strong className={`billing-${organization.paymentStatus.toLowerCase().replaceAll(" ", "-")}`}>{organization.paymentStatus} · {dateLabel(organization.nextChargeDate)}</strong></span></div>
    <div className="saas-seats"><div><span>Usuários</span><b>{organization.userCount} de {organization.maxUsers}</b></div><div><i style={{ width: `${usage}%` }} /></div></div>
    <div className="saas-meta"><p><Users /><span><b>Administrador</b>{organization.adminName || "Não definido"}</span></p><p><ShieldCheck /><span><b>Acesso</b>{organization.adminEmail || "Não definido"}</span></p><p><Building2 /><span><b>Registros</b>{organization.recordCount}</span></p><p><CalendarDays /><span><b>Criada em</b>{new Date(organization.createdAt).toLocaleDateString("pt-BR")}</span></p></div>
  </article>;
}

function OrganizationModal({ value, close, saved }: { value: SaasOrganization | "new"; close: () => void; saved: () => Promise<void> }) {
  const current = value === "new" ? null : value;
  const [form, setForm] = useState<Form>(current ? { name: current.name, slug: current.slug, logoDataUrl: current.logoDataUrl, plan: current.plan, status: current.status, maxUsers: current.maxUsers, renewalDate: current.renewalDate, notes: current.notes, adminName: current.adminName, adminEmail: current.adminEmail, temporaryPassword: "", monthlyPrice: current.monthlyPrice, billingCycle: current.billingCycle, billingDay: current.billingDay, billingEmail: current.billingEmail, paymentMethod: current.paymentMethod, paymentStatus: current.paymentStatus, nextChargeDate: current.nextChargeDate, graceUntil: current.graceUntil } : blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [slugEdited, setSlugEdited] = useState(Boolean(current));

  function selectLogo(file?: File) {
    setError("");
    if (!file) return;
    if (!/image\/(png|jpeg|webp)/.test(file.type)) return setError("Use uma logo PNG, JPG ou WebP.");
    if (file.size > 1_500_000) return setError("A logo deve ter no máximo 1,5 MB.");
    const reader = new FileReader();
    reader.onload = () => setForm((state) => ({ ...state, logoDataUrl: String(reader.result || "") }));
    reader.onerror = () => setError("Não foi possível ler a logo.");
    reader.readAsDataURL(file);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const payload = current ? { name: form.name, slug: form.slug, logoDataUrl: form.logoDataUrl, plan: form.plan, status: form.status, maxUsers: form.maxUsers, renewalDate: form.renewalDate, notes: form.notes, monthlyPrice: form.monthlyPrice, billingCycle: form.billingCycle, billingDay: form.billingDay, billingEmail: form.billingEmail, paymentMethod: form.paymentMethod, paymentStatus: form.paymentStatus, nextChargeDate: form.nextChargeDate, graceUntil: form.graceUntil } : form;
      await request(current ? `/api/admin/organizations/${current.id}` : "/api/admin/organizations", { method: current ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      await saved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar a empresa."); setBusy(false); }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><div className="modal saas-modal" role="dialog" aria-modal="true" aria-labelledby="saas-modal-title"><div className="modal-head"><div><span className="eyebrow">ADMIN SAAS MESTRE</span><h2 id="saas-modal-title">{current ? "Editar empresa" : "Provisionar nova empresa"}</h2></div><button aria-label="Fechar" onClick={close}><X /></button></div><form onSubmit={submit}>
    <div className="saas-form-grid"><div className="saas-logo-field"><span>Logo da empresa</span><div><div>{form.logoDataUrl ? <Image src={form.logoDataUrl} alt="Prévia da logo" width={80} height={80} unoptimized /> : <ImageIcon />}</div><label className="ghost"><Upload /> {form.logoDataUrl ? "Trocar logo" : "Selecionar logo"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { selectLogo(event.target.files?.[0]); event.target.value = ""; }} /></label>{form.logoDataUrl && <button type="button" onClick={() => setForm({ ...form, logoDataUrl: "" })}>Remover</button>}</div></div>
      <label className="field"><span>Nome da empresa *</span><input required value={form.name} onChange={(event) => { const name = event.target.value; setForm((state) => ({ ...state, name, slug: slugEdited ? state.slug : slugify(name) })); }} /></label>
      <label className="field"><span>Identificador *</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => { setSlugEdited(true); setForm({ ...form, slug: slugify(event.target.value) }); }} /><small className="field-hint">Usado para identificar a conta: /{form.slug || "empresa"}</small></label>
      <label className="field"><span>Plano *</span><select value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value as Form["plan"] })}><option>Start</option><option>Smart</option><option>Pro</option><option>Enterprise</option></select></label>
      <label className="field"><span>Status *</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Form["status"] })}><option>Teste</option><option>Ativo</option><option>Suspenso</option><option>Cancelado</option></select></label>
      <label className="field"><span>Limite de usuários *</span><input required type="number" min="1" max="500" value={form.maxUsers} onChange={(event) => setForm({ ...form, maxUsers: Number(event.target.value) })} /></label>
      <label className="field"><span>Próxima renovação</span><input type="date" value={form.renewalDate} onChange={(event) => setForm({ ...form, renewalDate: event.target.value })} /></label>
      {!current && <><div className="saas-form-divider"><span>ADMINISTRADOR DA EMPRESA</span><p>Será solicitado que altere a senha provisória no primeiro acesso.</p></div><label className="field"><span>Nome do administrador *</span><input required value={form.adminName} onChange={(event) => setForm({ ...form, adminName: event.target.value })} /></label><label className="field"><span>E-mail do administrador *</span><input required type="email" value={form.adminEmail} onChange={(event) => setForm({ ...form, adminEmail: event.target.value })} /></label><label className="field full"><span>Senha provisória *</span><input required minLength={10} type="password" autoComplete="new-password" value={form.temporaryPassword} onChange={(event) => setForm({ ...form, temporaryPassword: event.target.value })} /><small className="field-hint">Mínimo de 10 caracteres. A senha não aparece novamente após o cadastro.</small></label></>}
      {current && <div className="saas-current-admin"><ShieldCheck /><span><b>Administrador atual</b>{current.adminName} · {current.adminEmail}</span></div>}
      <div className="saas-form-divider"><span>PLANO E COBRANÇA</span><p>Controle comercial da assinatura. A integração automática com o gateway será conectada separadamente.</p></div>
      <label className="field"><span>Valor da assinatura (R$)</span><input type="number" min="0" step="0.01" value={form.monthlyPrice} onChange={(event) => setForm({ ...form, monthlyPrice: Number(event.target.value) })} /></label>
      <label className="field"><span>Ciclo de cobrança</span><select value={form.billingCycle} onChange={(event) => setForm({ ...form, billingCycle: event.target.value as Form["billingCycle"] })}><option>Mensal</option><option>Trimestral</option><option>Anual</option></select></label>
      <label className="field"><span>Dia do vencimento</span><input type="number" min="1" max="31" value={form.billingDay} onChange={(event) => setForm({ ...form, billingDay: Number(event.target.value) })} /></label>
      <label className="field"><span>E-mail financeiro</span><input type="email" value={form.billingEmail} placeholder={form.adminEmail || "financeiro@empresa.com"} onChange={(event) => setForm({ ...form, billingEmail: event.target.value })} /></label>
      <label className="field"><span>Forma de pagamento</span><select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as Form["paymentMethod"] })}><option>Pix</option><option>Boleto</option><option>Cartão</option><option>Transferência</option></select></label>
      <label className="field"><span>Status da cobrança</span><select value={form.paymentStatus} onChange={(event) => setForm({ ...form, paymentStatus: event.target.value as Form["paymentStatus"] })}><option>Em dia</option><option>Pendente</option><option>Atrasado</option><option>Isento</option></select></label>
      <label className="field"><span>Próxima cobrança</span><input type="date" value={form.nextChargeDate} onChange={(event) => setForm({ ...form, nextChargeDate: event.target.value })} /></label>
      <label className="field"><span>Prazo de regularização</span><input type="date" value={form.graceUntil} onChange={(event) => setForm({ ...form, graceUntil: event.target.value })} /></label>
      <label className="field full"><span>Observações internas</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
    </div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="ghost" onClick={close}>Cancelar</button><button className="primary" disabled={busy}>{busy ? "Salvando…" : current ? "Salvar alterações" : "Criar empresa e acesso"}</button></div>
  </form></div></div>;
}
