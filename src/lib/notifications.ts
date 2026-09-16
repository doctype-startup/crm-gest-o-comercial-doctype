import { randomUUID } from "node:crypto";
import { db } from "./db";
import { resolveModulePermissions } from "./modules";
import type { RecordModuleKey, Role } from "./types";

type Recipient = { id: string; name: string; email: string };

/** Usuários ativos da organização com permissão de leitura no módulo — respeita o papel e as exceções por usuário (ver user_module_permissions). */
export async function usersWithModuleAccess(orgId: string, module: RecordModuleKey): Promise<Recipient[]> {
  const [users, overrides] = await Promise.all([
    db.selectFrom("users").select(["id", "name", "email", "role"]).where("org_id", "=", orgId).where("active", "=", 1).execute(),
    db.selectFrom("user_module_permissions").select(["user_id", "module", "can_read", "can_write"]).where("org_id", "=", orgId).execute(),
  ]);
  const overridesByUser = new Map<string, typeof overrides>();
  for (const row of overrides) overridesByUser.set(row.user_id, [...(overridesByUser.get(row.user_id) ?? []), row]);
  return users
    .filter((user) => resolveModulePermissions(user.role as Role, overridesByUser.get(user.id) ?? []).read.includes(module))
    .map((user) => ({ id: user.id, name: user.name, email: user.email }));
}

async function sendNotificationEmail(recipient: Recipient, title: string, body: string) {
  // Importado sob demanda (não no topo do arquivo): resend.ts é guardado por
  // "server-only" e não pode ser carregado fora de uma rota/servidor Next.js —
  // isso mantém notifications.ts importável por testes que não configuram e-mail.
  if (!process.env.RESEND_API_KEY) return;
  try {
    const { getResend, notificationsFromAddress } = await import("./resend");
    await getResend().emails.send({
      from: notificationsFromAddress(),
      to: recipient.email,
      subject: title,
      html: `<p>Olá, ${recipient.name}.</p><p>${body}</p><p style="color:#8a93a2;font-size:12px">DOCTYPE OS — notificação automática.</p>`,
    });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", message: "Falha ao enviar e-mail de notificação", recipient: recipient.email, error: error instanceof Error ? error.message : String(error) }));
  }
}

/** Cria uma notificação (central dentro da plataforma) para cada destinatário e dispara o e-mail correspondente, best-effort — nunca lança se o envio de e-mail falhar. */
export async function notifyUsers(orgId: string, recipients: Recipient[], input: { title: string; body: string; link?: string }) {
  if (!recipients.length) return;
  const now = new Date().toISOString();
  const rows = recipients.map((recipient) => ({ id: randomUUID(), org_id: orgId, user_id: recipient.id, title: input.title, body: input.body, link: input.link || "", read: 0, created_at: now }));
  await db.insertInto("notifications").values(rows).execute();
  await Promise.all(recipients.map((recipient) => sendNotificationEmail(recipient, input.title, input.body)));
}
