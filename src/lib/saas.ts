import { z } from "zod";

const logoDataUrl = z.string().max(2_100_000).refine((value) => !value || /^data:image\/(png|jpeg|webp);base64,/i.test(value), "Logo inválida.").default("");
const renewalDate = z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default("");

export const saasAccountSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().toLowerCase().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens."),
  logoDataUrl,
  plan: z.enum(["Start", "Smart", "Pro", "Enterprise"]),
  status: z.enum(["Teste", "Ativo", "Suspenso", "Cancelado"]),
  maxUsers: z.coerce.number().int().min(1).max(500),
  renewalDate,
  notes: z.string().trim().max(2000).default(""),
});

export const createSaasAccountSchema = saasAccountSchema.extend({
  adminName: z.string().trim().min(2).max(200),
  adminEmail: z.string().trim().email().max(200),
  temporaryPassword: z.string().min(10).max(200),
});

export type SaasAccountInput = z.infer<typeof saasAccountSchema>;
