import type Stripe from "stripe";

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
