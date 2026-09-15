import type Stripe from "stripe";
import { createHash } from "node:crypto";

export type BillingCycle = "Mensal" | "Trimestral" | "Anual";

export function stripeCycle(cycle: BillingCycle) {
  if (cycle === "Trimestral") return { interval: "month" as const, intervalCount: 3, schedule: "quarterly" as const, multiplier: 3 };
  if (cycle === "Anual") return { interval: "year" as const, intervalCount: 1, schedule: "yearly" as const, multiplier: 12 };
  return { interval: "month" as const, intervalCount: 1, schedule: "monthly" as const, multiplier: 1 };
}

export function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id || "";
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  return stripeId(invoice.parent?.subscription_details?.subscription);
}

export function isoDateFromUnix(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString().slice(0, 10) : "";
}

export function stripeEventStream(type: string) {
  if (type.startsWith("checkout.session.")) return "checkout" as const;
  if (type.startsWith("invoice.")) return "invoice" as const;
  if (type.startsWith("customer.subscription.")) return "subscription" as const;
  return null;
}

/**
 * Só evita duplicar a sessão de checkout em cliques repetidos/retries de rede muito
 * próximos — por isso o bucket é de 1 minuto, não o dia inteiro. Um bucket largo
 * (ex.: o dia todo) faz a MESMA chave ser reenviada com um corpo de requisição
 * diferente sempre que o código muda (ex.: um fix de bug) ou numa nova tentativa
 * horas depois, e a Stripe rejeita isso com StripeIdempotencyError — travando
 * qualquer tentativa de ativar cobrança pro resto do dia.
 */
export function checkoutIdempotencyKey(input: { orgId: string; plan: string; monthlyPrice: number; billingCycle: BillingCycle; date?: Date }) {
  const minuteBucket = (input.date || new Date()).toISOString().slice(0, 16);
  const fingerprint = `${input.orgId}|${input.plan}|${input.monthlyPrice.toFixed(2)}|${input.billingCycle}|${minuteBucket}`;
  return `doctype-billing-${createHash("sha256").update(fingerprint).digest("hex")}`;
}

export type BillingMethodLabel = "Pix" | "Cartão" | "Boleto";

/**
 * Métodos oferecidos no checkout hoje. "Transferência" permanece manual/administrativa.
 * Boleto está pausado temporariamente (fora da lista) enquanto sua ativação na conta
 * Stripe usada em produção não é confirmada — volte a incluir "boleto" aqui assim que
 * estiver validado em modo live, sem precisar mexer em mais nada.
 */
export const AUTOMATED_PAYMENT_METHOD_TYPES = ["pix", "card"] as const;

export function billingMethodFromStripeType(type: string | null | undefined): BillingMethodLabel | null {
  if (type === "pix") return "Pix";
  if (type === "card") return "Cartão";
  if (type === "boleto") return "Boleto";
  return null;
}
