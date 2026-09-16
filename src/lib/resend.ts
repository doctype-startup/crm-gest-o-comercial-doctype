import "server-only";

import { Resend } from "resend";

let client: Resend | null = null;

export function resendIsConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_NOT_CONFIGURED");
  client ??= new Resend(key);
  return client;
}

// Sem domínio verificado no Resend (Domains > Add Domain), este remetente de teste
// só entrega para o e-mail da própria conta Resend — suficiente para conferir o
// envio antes de configurar um domínio real. Ver README.md > "Notificações por e-mail".
export function notificationsFromAddress() {
  return process.env.NOTIFICATIONS_FROM_EMAIL || "DOCTYPE OS <onboarding@resend.dev>";
}
