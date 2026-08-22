import { z } from "zod";
import type { RecordModuleKey, Role } from "./types";

const text = z.string().trim().max(1000).default("");
const longText = z.string().max(4_500_000).default("");
const required = z.string().trim().min(1).max(200);
const amount = z.coerce.number().finite().min(0).default(0);
const date = z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default("");

export const moduleSchemas: Record<RecordModuleKey, z.ZodType<Record<string, unknown>>> = {
  clients: z.object({
    name: required,
    document: text,
    contact: text,
    services: text,
    productIds: z.array(z.string().max(100)).default([]),
    monthly: amount,
    dueDay: z.coerce.number().int().min(1).max(31).default(1),
    startDate: date,
    renewal: date,
    noticeDays: z.coerce.number().int().min(0).max(365).default(30),
    responsible: text,
    health: z.enum(["Saudável", "Atenção", "Risco"]).default("Saudável"),
    status: z.enum(["Ativo", "Pausado", "Encerrado"]).default("Ativo"),
    observations: text,
  }),
  accesses: z.object({
    clientId: required,
    platform: required,
    login: text,
    user: text,
    url: z.union([z.literal(""), z.string().url().max(500)]).default(""),
    twoFA: z.coerce.boolean().default(false),
    responsible: text,
    status: z.enum(["OK", "Pendente", "Bloqueado", "Revogado"]).default("OK"),
    secretRef: text,
    observations: text,
  }),
  invoices: z.object({ clientId: required, description: required, value: amount, due: date, paidAt: date, status: z.enum(["Pendente", "Pago", "Vencido", "Cancelado"]).default("Pendente"), recurring: z.coerce.boolean().default(false) }),
  expenses: z.object({ name: required, category: text, value: amount, due: date, paidAt: date, status: z.enum(["Previsto", "Pago", "Vencido", "Cancelado"]).default("Previsto"), recurring: z.coerce.boolean().default(false) }),
  tasks: z.object({ title: required, clientId: text, responsible: text, due: date, priority: z.enum(["Baixa", "Média", "Alta", "Crítica"]).default("Média"), status: z.enum(["Aberta", "Em andamento", "Aguardando", "Concluída"]).default("Aberta"), description: text }),
  crm: z.object({ clientId: required, plan: z.enum(["Start", "Smart", "Pro", "Legado"]).default("Smart"), mrr: amount, setup: amount, platformCost: amount, channelCost: amount, status: z.enum(["Ativo", "Pausado", "Cancelado"]).default("Ativo"), observations: text }),
  team: z.object({ name: required, role: required, email: z.union([z.literal(""), z.string().email().max(200)]).default(""), cost: amount, responsibilities: text, status: z.enum(["Ativo", "Inativo"]).default("Ativo") }),
  products: z.object({ name: required, sku: text, category: text, description: text, price: amount, cost: amount, unit: z.enum(["unidade", "serviço", "hora", "mês", "projeto"]).default("serviço"), billingType: z.enum(["Único", "Mensal", "Trimestral", "Semestral", "Anual"]).default("Único"), status: z.enum(["Ativo", "Inativo"]).default("Ativo"), notes: text }),
  quotes: z.object({ number: required, clientId: required, title: required, productIds: z.array(z.string().max(100)).default([]), subtotal: amount, discount: amount, total: amount, validUntil: date, status: z.enum(["Rascunho", "Enviado", "Aprovado", "Recusado", "Expirado"]).default("Rascunho"), notes: text }),
  contracts: z.object({ number: required, clientId: required, quoteId: text, title: required, productIds: z.array(z.string().max(100)).default([]), value: amount, startDate: date, endDate: date, signedAt: date, status: z.enum(["Rascunho", "Enviado", "Assinado", "Vencido", "Cancelado"]).default("Rascunho"), fileName: text, fileDataUrl: longText, observations: text }),
};

const readByRole: Record<Role, RecordModuleKey[]> = {
  CEO_ADMIN: ["clients", "accesses", "invoices", "expenses", "tasks", "crm", "team", "products", "quotes", "contracts"],
  OPERATIONS: ["clients", "accesses", "tasks", "crm", "team", "products", "quotes", "contracts"],
  FINANCE: ["clients", "invoices", "expenses", "crm", "products", "quotes", "contracts"],
};

const writeByRole: Record<Role, RecordModuleKey[]> = {
  CEO_ADMIN: readByRole.CEO_ADMIN,
  OPERATIONS: ["clients", "accesses", "tasks", "crm", "team", "products", "quotes", "contracts"],
  FINANCE: ["invoices", "expenses", "crm", "quotes", "contracts"],
};

export function canRead(role: Role, module: RecordModuleKey) { return readByRole[role].includes(module); }
export function canWrite(role: Role, module: RecordModuleKey) { return writeByRole[role].includes(module); }
export function isModule(value: string): value is RecordModuleKey { return value in moduleSchemas; }
