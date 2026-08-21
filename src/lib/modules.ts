import { z } from "zod";
import type { ModuleKey, Role } from "./types";

const text = z.string().trim().max(1000).default("");
const required = z.string().trim().min(1).max(200);
const amount = z.coerce.number().finite().min(0).default(0);
const date = z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default("");

export const moduleSchemas: Record<ModuleKey, z.ZodType<Record<string, unknown>>> = {
  clients: z.object({
    name: required,
    document: text,
    contact: text,
    services: text,
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
  invoices: z.object({
    clientId: required,
    description: required,
    value: amount,
    due: date,
    paidAt: date,
    status: z.enum(["Pendente", "Pago", "Vencido", "Cancelado"]).default("Pendente"),
    recurring: z.coerce.boolean().default(false),
  }),
  expenses: z.object({
    name: required,
    category: text,
    value: amount,
    due: date,
    paidAt: date,
    status: z.enum(["Previsto", "Pago", "Vencido", "Cancelado"]).default("Previsto"),
    recurring: z.coerce.boolean().default(false),
  }),
  tasks: z.object({
    title: required,
    clientId: text,
    responsible: text,
    due: date,
    priority: z.enum(["Baixa", "Média", "Alta", "Crítica"]).default("Média"),
    status: z.enum(["Aberta", "Em andamento", "Aguardando", "Concluída"]).default("Aberta"),
    description: text,
  }),
  crm: z.object({
    clientId: required,
    plan: z.enum(["Start", "Smart", "Pro", "Legado"]).default("Smart"),
    mrr: amount,
    setup: amount,
    platformCost: amount,
    channelCost: amount,
    status: z.enum(["Ativo", "Pausado", "Cancelado"]).default("Ativo"),
    observations: text,
  }),
  team: z.object({
    name: required,
    role: required,
    email: z.union([z.literal(""), z.string().email().max(200)]).default(""),
    cost: amount,
    responsibilities: text,
    status: z.enum(["Ativo", "Inativo"]).default("Ativo"),
  }),
};

const readByRole: Record<Role, ModuleKey[]> = {
  CEO_ADMIN: ["clients", "accesses", "invoices", "expenses", "tasks", "crm", "team"],
  OPERATIONS: ["clients", "accesses", "tasks", "crm", "team"],
  FINANCE: ["clients", "invoices", "expenses", "crm"],
};

const writeByRole: Record<Role, ModuleKey[]> = {
  CEO_ADMIN: readByRole.CEO_ADMIN,
  OPERATIONS: ["clients", "accesses", "tasks", "crm", "team"],
  FINANCE: ["invoices", "expenses", "crm"],
};

export function canRead(role: Role, module: ModuleKey) {
  return readByRole[role].includes(module);
}

export function canWrite(role: Role, module: ModuleKey) {
  return writeByRole[role].includes(module);
}

export function isModule(value: string): value is ModuleKey {
  return value in moduleSchemas;
}
