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

export function checkoutIdempotencyKey(input: { orgId: string; plan: string; monthlyPrice: number; billingCycle: BillingCycle; date?: Date }) {
  const day = (input.date || new Date()).toISOString().slice(0, 10);
  const fingerprint = `${input.orgId}|${input.plan}|${input.monthlyPrice.toFixed(2)}|${input.billingCycle}|${day}`;
  return `doctype-pix-${createHash("sha256").update(fingerprint).digest("hex")}`;
}
