"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeDollarSign, CalendarDays, CheckCircle2, CreditCard, Mail, RefreshCw, ShieldCheck, Users } from "lucide-react";

type Subscription = {
  organizationName: string; plan: string; accountStatus: string; maxUsers: number; renewalDate: string;
  monthlyPrice: number; billingCycle: string; billingDay: number; billingEmail: string; paymentMethod: string;
  paymentStatus: string; nextChargeDate: string; graceUntil: string; automaticBilling: boolean;
};

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (value: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "A definir";

export function SubscriptionView() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/billing");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar a assinatura.");
      setSubscription(body.subscription);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar a assinatura."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/billing").then(async (response) => ({ response, body: await response.json() })).then(({ response, body }) => {
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar a assinatura.");
      if (active) setSubscription(body.subscription);
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar a assinatura."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="subscription-loading"><i /> Carregando assinatura…</div>;
  if (error || !subscription) return <div className="empty-state"><CreditCard /><h3>Não foi possível carregar sua assinatura.</h3><p>{error}</p><button className="primary" onClick={() => void load()}><RefreshCw /> Tentar novamente</button></div>;

  const paymentClass = subscription.paymentStatus.toLowerCase().replaceAll(" ", "-");
  return <div className="subscription-page stack">
    <section className="subscription-hero"><div><span><ShieldCheck /> ASSINATURA PROTEGIDA</span><h2>{subscription.organizationName}</h2><p>Plano, cobrança e dados financeiros visíveis somente para o administrador da sua empresa.</p></div><div><small>Plano atual</small><strong>{subscription.plan}</strong><em>{subscription.accountStatus}</em></div></section>
    <div className="subscription-kpis"><article><BadgeDollarSign /><span>Valor contratado</span><strong>{subscription.monthlyPrice ? money(subscription.monthlyPrice) : "A definir"}</strong><small>Cobrança {subscription.billingCycle.toLowerCase()}</small></article><article><CalendarDays /><span>Próxima cobrança</span><strong>{dateLabel(subscription.nextChargeDate)}</strong><small>Vencimento no dia {subscription.billingDay}</small></article><article><CreditCard /><span>Forma de pagamento</span><strong>{subscription.paymentMethod}</strong><small>{subscription.automaticBilling ? "Cobrança automática ativa" : "Cobrança administrada pela DOCTYPE"}</small></article><article><Users /><span>Licenças incluídas</span><strong>{subscription.maxUsers || "—"}</strong><small>Usuários permitidos no plano</small></article></div>
    <section className="subscription-card"><header><div><CheckCircle2 /><span><small>Status da cobrança</small><strong className={paymentClass}>{subscription.paymentStatus}</strong></span></div><p>Renovação contratual: <b>{dateLabel(subscription.renewalDate)}</b></p></header><div className="subscription-details"><p><Mail /><span><b>E-mail financeiro</b>{subscription.billingEmail}</span></p><p><CalendarDays /><span><b>Prazo de regularização</b>{dateLabel(subscription.graceUntil)}</span></p><p><ShieldCheck /><span><b>Privacidade</b>Outras empresas não conseguem visualizar esta assinatura.</span></p></div><footer>A gestão e alteração do plano são realizadas pela DOCTYPE. A cobrança automática por cartão será habilitada após a conexão segura com o gateway.</footer></section>
  </div>;
}
