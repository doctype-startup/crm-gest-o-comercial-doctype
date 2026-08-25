import "server-only";

import Stripe from "stripe";

let client: Stripe | null = null;

export function stripeIsConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripeIsTestMode() {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ?? false;
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_NOT_CONFIGURED");
  client ??= new Stripe(key, { typescript: true });
  return client;
}
