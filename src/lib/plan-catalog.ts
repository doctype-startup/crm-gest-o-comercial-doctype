/**
 * Preços/limites públicos dos planos vendidos via cadastro self-service (/cadastro).
 * Fonte única da verdade para o que o cliente vê e para o valor cobrado no checkout —
 * ajuste aqui para mudar preço/limite de todos os novos cadastros de uma vez.
 * "Enterprise" continua sob consulta e não passa por aqui (provisionado manualmente
 * pelo Admin SaaS Mestre, como qualquer conta hoje).
 */

export type SelfServePlanId = "Start" | "Smart" | "Pro";

export type PlanCatalogEntry = {
  id: SelfServePlanId;
  label: string;
  monthlyPrice: number;
  maxUsers: number;
  headline: string;
  features: string[];
};

export const SELF_SERVE_PLANS: readonly PlanCatalogEntry[] = [
  {
    id: "Start",
    label: "Start",
    monthlyPrice: 197,
    maxUsers: 3,
    headline: "Para quem está organizando a operação pela primeira vez.",
    features: ["Até 3 usuários", "Clientes 360°, Financeiro e Operação", "DOC Monitor incluso"],
  },
  {
    id: "Smart",
    label: "Smart",
    monthlyPrice: 397,
    maxUsers: 8,
    headline: "Para equipes que já vendem, cobram e renovam contratos.",
    features: ["Até 8 usuários", "Tudo do Start", "DOC CRM, Renovações e Contratos"],
  },
  {
    id: "Pro",
    label: "Pro",
    monthlyPrice: 697,
    maxUsers: 20,
    headline: "Para operações maiores com múltiplos times e clientes.",
    features: ["Até 20 usuários", "Tudo do Smart", "Suporte prioritário"],
  },
] as const;

export function planCatalogEntry(id: string): PlanCatalogEntry | undefined {
  return SELF_SERVE_PLANS.find((plan) => plan.id === id);
}
