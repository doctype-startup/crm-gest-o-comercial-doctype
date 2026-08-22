"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileSignature, FileText, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import type { AppRecord, CommercialModuleKey, SessionUser } from "@/lib/types";

type StatePayload = { records: AppRecord[]; user: SessionUser };
type CommercialView = CommercialModuleKey;
type Modal = { module: CommercialView; record?: AppRecord } | null;

const money = (value: unknown) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const text = (value: unknown) => String(value ?? "");
const arr = (value: unknown) => Array.isArray(value) ? value.map(String) : [];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir a operação.");
  return body;
}

export function CommercialSuite({ initialState }: { initialState: StatePayload }) {
  const [state, setState] = useState(initialState);
  const [view, setView] = useState<CommercialView | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [search, setSearch] = useState("");
  const [navTarget, setNavTarget] = useState<Element | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const records = state.records;
  const clients = records.filter((r) => r.module === "clients");
  const products = records.filter((r) => r.module === "products");
  const quotes = records.filter((r) => r.module === "quotes");
  const contracts = records.filter((r) => r.module === "contracts");

  const clientName = (id: unknown) => text(clients.find((r) => r.id === id)?.data.name) || "—";
  const productNames = (ids: unknown) => arr(ids).map((id) => text(products.find((r) => r.id === id)?.data.name)).filter(Boolean).join(", ") || "—";

  async function refresh() {
    const payload = await api<StatePayload>("/api/state");
    setState(payload);
    window.dispatchEvent(new Event("doctype:records-changed"));
    return payload;
  }

  async function openCommercial(next: CommercialView) {
    setError("");
    await refresh();
    setView(next);
    setSearch("");
  }

  async function openCreate(module: CommercialView) {
    setError("");
    await refresh();
    setModal({ module });
  }

  useEffect(() => {
    const find = () => setNavTarget(document.querySelector(".sidebar nav"));
    const observer = new MutationObserver(find);
    find();
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function remove(record: AppRecord) {
    if (!window.confirm("Excluir este registro?")) return;
    try {
      await api(`/api/records/${record.id}?module=${record.module}`, { method: "DELETE" });
      setToast("Registro excluído.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao excluir.");
    }
  }

  const nav = navTarget ? createPortal(<>
    <button className={view === "products" ? "active" : ""} onClick={() => { void openCommercial("products"); }}><Package size={18} /><span>Produtos</span></button>
    <button className={view === "quotes" ? "active" : ""} onClick={() => { void openCommercial("quotes"); }}><FileText size={18} /><span>Orçamentos</span></button>
    <button className={view === "contracts" ? "active" : ""} onClick={() => { void openCommercial("contracts"); }}><FileSignature size={18} /><span>Contratos</span></button>
  </>, navTarget) : null;

  const source = view === "products" ? products : view === "quotes" ? quotes : contracts;
  const term = search.trim().toLowerCase();
  const filtered = term ? source.filter((record) => JSON.stringify(record.data).toLowerCase().includes(term)) : source;

  return <>
    {nav}
    {view && <div className="commercial-page commercial-suite">
      <header className="commercial-head">
        <div><span>GESTÃO COMERCIAL</span><h1>{view === "products" ? "Produtos" : view === "quotes" ? "Orçamentos" : "Contratos"}</h1><p>{view === "products" ? "Catálogo, preço, custo, recorrência e margem." : view === "quotes" ? "Propostas vinculadas a clientes e produtos." : "Contratos assinados e documentos dos clientes."}</p></div>
        <div className="commercial-actions"><button className="ghost" onClick={() => setView(null)}><X size={17} /> Fechar</button><button className="primary" onClick={() => { void openCreate(view); }}><Plus size={17} /> {view === "products" ? "Produto" : view === "quotes" ? "Orçamento" : "Contrato"}</button></div>
      </header>
      <div className="commercial-kpis">
        {view === "products" && <><MiniKpi label="Produtos ativos" value={String(products.filter((r) => r.data.status === "Ativo").length)} /><MiniKpi label="Categorias" value={String(new Set(products.map((r) => text(r.data.category)).filter(Boolean)).size)} /><MiniKpi label="Ticket médio" value={money(products.length ? products.reduce((s, r) => s + Number(r.data.price || 0), 0) / products.length : 0)} /></>}
        {view === "quotes" && <><MiniKpi label="Orçamentos" value={String(quotes.length)} /><MiniKpi label="Aprovados" value={String(quotes.filter((r) => r.data.status === "Aprovado").length)} /><MiniKpi label="Valor aprovado" value={money(quotes.filter((r) => r.data.status === "Aprovado").reduce((s, r) => s + Number(r.data.total || 0), 0))} /></>}
        {view === "contracts" && <><MiniKpi label="Contratos" value={String(contracts.length)} /><MiniKpi label="Assinados" value={String(contracts.filter((r) => r.data.status === "Assinado").length)} /><MiniKpi label="Valor contratado" value={money(contracts.filter((r) => r.data.status === "Assinado").reduce((s, r) => s + Number(r.data.value || 0), 0))} /></>}
      </div>
      <label className="commercial-search"><Search size={18} /><input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      {error && <div className="commercial-error">{error}</div>}
      <div className="commercial-table"><table><thead><tr>{view === "products" ? <><th>Produto</th><th>SKU</th><th>Categoria</th><th>Preço</th><th>Custo</th><th>Margem</th><th>Cobrança</th><th>Status</th></> : view === "quotes" ? <><th>Nº</th><th>Cliente</th><th>Produtos</th><th>Total</th><th>Validade</th><th>Status</th></> : <><th>Nº</th><th>Cliente</th><th>Produtos</th><th>Valor</th><th>Vigência</th><th>Documento</th><th>Status</th></>}<th>Ações</th></tr></thead><tbody>
        {filtered.map((record) => <tr key={record.id}>{view === "products" ? <><td><strong>{text(record.data.name)}</strong><small>{text(record.data.description)}</small></td><td>{text(record.data.sku) || "—"}</td><td>{text(record.data.category) || "—"}</td><td>{money(record.data.price)}</td><td>{money(record.data.cost)}</td><td>{Number(record.data.price || 0) ? `${Math.round(((Number(record.data.price || 0) - Number(record.data.cost || 0)) / Number(record.data.price || 1)) * 100)}%` : "—"}</td><td>{text(record.data.billingType)}</td><td><Status value={text(record.data.status)} /></td></> : view === "quotes" ? <><td>{text(record.data.number)}</td><td>{clientName(record.data.clientId)}</td><td>{productNames(record.data.productIds)}</td><td>{money(record.data.total)}</td><td>{text(record.data.validUntil) || "—"}</td><td><Status value={text(record.data.status)} /></td></> : <><td>{text(record.data.number)}</td><td>{clientName(record.data.clientId)}</td><td>{productNames(record.data.productIds)}</td><td>{money(record.data.value)}</td><td>{text(record.data.startDate) || "—"}{record.data.endDate ? ` → ${text(record.data.endDate)}` : ""}</td><td>{record.data.fileDataUrl ? <a className="contract-download" href={text(record.data.fileDataUrl)} download={text(record.data.fileName) || "contrato.pdf"}><Download size={14} /> {text(record.data.fileName) || "Baixar"}</a> : "—"}</td><td><Status value={text(record.data.status)} /></td></>}<td><div className="commercial-row-actions"><button aria-label="Editar" onClick={() => setModal({ module: view, record })}><Pencil size={15} /></button><button aria-label="Excluir" className="danger" onClick={() => remove(record)}><Trash2 size={15} /></button></div></td></tr>)}
        {!filtered.length && <tr><td colSpan={9} className="commercial-empty">Nenhum registro encontrado.</td></tr>}
      </tbody></table></div>
    </div>}
    {modal && <CommercialModal modal={modal} clients={clients} products={products} quotes={quotes} close={() => setModal(null)} saved={async () => { setModal(null); setToast("Registro salvo."); await refresh(); }} />}
    {toast && <div className="commercial-toast">{toast}</div>}
  </>;
}

function MiniKpi({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function Status({ value }: { value: string }) { const cls = /ativo|assinado|aprovado/i.test(value) ? "ok" : /cancel|recus|venc/i.test(value) ? "bad" : "warn"; return <span className={`commercial-status ${cls}`}>{value || "—"}</span>; }

function CommercialModal({ modal, clients, products, quotes, close, saved }: { modal: Exclude<Modal, null>; clients: AppRecord[]; products: AppRecord[]; quotes: AppRecord[]; close: () => void; saved: () => Promise<void> }) {
  const record = modal.record;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const existing = record?.data || {};
  const [data, setData] = useState<Record<string, unknown>>(() => modal.module === "products" ? {
    name: "", sku: "", category: "", description: "", price: 0, cost: 0, unit: "serviço", billingType: "Único", status: "Ativo", notes: "", ...existing
  } : modal.module === "quotes" ? {
    number: `ORC-${Date.now().toString().slice(-6)}`, clientId: "", title: "", productIds: [], subtotal: 0, discount: 0, total: 0, validUntil: "", status: "Rascunho", notes: "", ...existing
  } : {
    number: `CTR-${Date.now().toString().slice(-6)}`, clientId: "", quoteId: "", title: "", productIds: [], value: 0, startDate: "", endDate: "", signedAt: "", status: "Rascunho", fileName: "", fileDataUrl: "", observations: "", ...existing
  });

  const toggleProduct = (id: string) => setData((current) => ({ ...current, productIds: arr(current.productIds).includes(id) ? arr(current.productIds).filter((x) => x !== id) : [...arr(current.productIds), id] }));
  const selectedProducts = products.filter((p) => arr(data.productIds).includes(p.id));
  const productsSubtotal = selectedProducts.reduce((sum, p) => sum + Number(p.data.price || 0), 0);
  const quoteTotal = Math.max(0, productsSubtotal - Number(data.discount || 0));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payloadData = modal.module === "quotes" ? { ...data, subtotal: productsSubtotal, total: quoteTotal } : data;
      await api(record ? `/api/records/${record.id}` : "/api/records", {
        method: record ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: modal.module, data: payloadData }),
      });
      await saved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao salvar.");
      setBusy(false);
    }
  }

  function attach(file?: File) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("O contrato deve ter no máximo 2 MB."); return; }
    if (file.type !== "application/pdf" && !file.type.startsWith("image/")) { setError("Use PDF ou imagem para o contrato."); return; }
    const reader = new FileReader();
    reader.onload = () => setData((current) => ({ ...current, fileName: file.name, fileDataUrl: String(reader.result || "") }));
    reader.onerror = () => setError("Não foi possível ler o arquivo selecionado.");
    reader.readAsDataURL(file);
  }

  const title = `${record ? "Editar" : "Novo"} ${modal.module === "products" ? "produto" : modal.module === "quotes" ? "orçamento" : "contrato"}`;
  return <div className="commercial-modal-backdrop commercial-suite"><div className="commercial-modal"><div className="commercial-modal-head"><div><span>DOC.OS</span><h2>{title}</h2></div><button aria-label="Fechar" onClick={close}><X /></button></div><form onSubmit={submit}><div className="commercial-form">
    {modal.module === "products" && <><Field label="Nome do produto *" value={data.name} set={(v) => setData({ ...data, name: v })} required /><Field label="SKU / Código" value={data.sku} set={(v) => setData({ ...data, sku: v })} /><Field label="Categoria" value={data.category} set={(v) => setData({ ...data, category: v })} /><Field label="Preço de venda" type="number" value={data.price} set={(v) => setData({ ...data, price: Number(v) })} /><Field label="Custo" type="number" value={data.cost} set={(v) => setData({ ...data, cost: Number(v) })} /><SelectField label="Unidade" value={data.unit} options={["unidade", "serviço", "hora", "mês", "projeto"]} set={(v) => setData({ ...data, unit: v })} /><SelectField label="Cobrança" value={data.billingType} options={["Único", "Mensal", "Trimestral", "Semestral", "Anual"]} set={(v) => setData({ ...data, billingType: v })} /><SelectField label="Status" value={data.status} options={["Ativo", "Inativo"]} set={(v) => setData({ ...data, status: v })} /><Area label="Descrição" value={data.description} set={(v) => setData({ ...data, description: v })} /><Area label="Observações internas" value={data.notes} set={(v) => setData({ ...data, notes: v })} /></>}
    {modal.module === "quotes" && <><Field label="Número *" value={data.number} set={(v) => setData({ ...data, number: v })} required /><ClientSelect clients={clients} value={data.clientId} set={(v) => setData({ ...data, clientId: v })} /><Field label="Título do orçamento *" value={data.title} set={(v) => setData({ ...data, title: v })} required /><ProductPicker products={products} selected={arr(data.productIds)} toggle={toggleProduct} /><Field label="Subtotal" type="number" value={productsSubtotal} set={() => undefined} disabled /><Field label="Desconto (R$)" type="number" value={data.discount} set={(v) => setData({ ...data, discount: Number(v) })} /><Field label="Total" type="number" value={quoteTotal} set={() => undefined} disabled /><Field label="Válido até" type="date" value={data.validUntil} set={(v) => setData({ ...data, validUntil: v })} /><SelectField label="Status" value={data.status} options={["Rascunho", "Enviado", "Aprovado", "Recusado", "Expirado"]} set={(v) => setData({ ...data, status: v })} /><Area label="Condições / observações" value={data.notes} set={(v) => setData({ ...data, notes: v })} /></>}
    {modal.module === "contracts" && <><Field label="Número *" value={data.number} set={(v) => setData({ ...data, number: v })} required /><ClientSelect clients={clients} value={data.clientId} set={(v) => setData({ ...data, clientId: v })} /><label><span>Orçamento relacionado</span><select value={text(data.quoteId)} onChange={(e) => setData({ ...data, quoteId: e.target.value })}><option value="">Sem vínculo</option>{quotes.map((q) => <option key={q.id} value={q.id}>{text(q.data.number)} — {text(q.data.title)}</option>)}</select></label><Field label="Título do contrato *" value={data.title} set={(v) => setData({ ...data, title: v })} required /><ProductPicker products={products} selected={arr(data.productIds)} toggle={toggleProduct} /><Field label="Valor do contrato" type="number" value={data.value} set={(v) => setData({ ...data, value: Number(v) })} /><Field label="Início" type="date" value={data.startDate} set={(v) => setData({ ...data, startDate: v })} /><Field label="Fim / renovação" type="date" value={data.endDate} set={(v) => setData({ ...data, endDate: v })} /><Field label="Data da assinatura" type="date" value={data.signedAt} set={(v) => setData({ ...data, signedAt: v })} /><SelectField label="Status" value={data.status} options={["Rascunho", "Enviado", "Assinado", "Vencido", "Cancelado"]} set={(v) => setData({ ...data, status: v })} /><label className="commercial-file"><span>Contrato assinado (PDF ou imagem, até 2 MB)</span><input type="file" accept="application/pdf,image/*" onChange={(e) => attach(e.target.files?.[0])} />{Boolean(data.fileName) && <small>Arquivo atual: {text(data.fileName)}</small>}</label><Area label="Observações" value={data.observations} set={(v) => setData({ ...data, observations: v })} /></>}
  </div>{error && <div className="commercial-error">{error}</div>}<div className="commercial-modal-actions"><button type="button" className="ghost" onClick={close}>Cancelar</button><button className="primary" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</button></div></form></div></div>;
}

function Field({ label, value, set, type = "text", required, disabled }: { label: string; value: unknown; set: (v: string) => void; type?: string; required?: boolean; disabled?: boolean }) { return <label><span>{label}</span><input type={type} step={type === "number" ? "0.01" : undefined} value={text(value)} required={required} disabled={disabled} onChange={(e) => set(e.target.value)} /></label>; }
function Area({ label, value, set }: { label: string; value: unknown; set: (v: string) => void }) { return <label className="full"><span>{label}</span><textarea value={text(value)} onChange={(e) => set(e.target.value)} /></label>; }
function SelectField({ label, value, options, set }: { label: string; value: unknown; options: string[]; set: (v: string) => void }) { return <label><span>{label}</span><select value={text(value)} onChange={(e) => set(e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select></label>; }
function ClientSelect({ clients, value, set }: { clients: AppRecord[]; value: unknown; set: (v: string) => void }) { return <label><span>Cliente *</span><select required value={text(value)} onChange={(e) => set(e.target.value)}><option value="">Selecione</option>{clients.map((c) => <option key={c.id} value={c.id}>{text(c.data.name)}</option>)}</select></label>; }
function ProductPicker({ products, selected, toggle }: { products: AppRecord[]; selected: string[]; toggle: (id: string) => void }) { return <div className="full commercial-picker"><span>Produtos</span><div>{products.filter((p) => p.data.status === "Ativo").map((p) => <button type="button" key={p.id} className={selected.includes(p.id) ? "selected" : ""} onClick={() => toggle(p.id)}><strong>{text(p.data.name)}</strong><small>{money(p.data.price)}</small></button>)}{!products.length && <em>Cadastre produtos primeiro.</em>}</div></div>; }
