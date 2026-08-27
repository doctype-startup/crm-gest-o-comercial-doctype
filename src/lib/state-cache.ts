import type { AppRecord } from "./types";

// Micro-cache do "estado bruto" (todos os registros + settings de uma organização)
// para absorver o poll de 3s do DOC Monitor. Cada instância serverless mantém o seu
// próprio cache em memória (não é compartilhado entre instâncias) — o objetivo não é
// consistência forte, é evitar que N usuários da mesma org, dentro da mesma janela de
// alguns segundos, gerem N consultas idênticas ao banco. Escrita em qualquer registro
// da organização invalida o cache imediatamente (ver invalidateState), então nenhum
// usuário vê dado desatualizado depois da própria gravação.
type RawState = {
  records: AppRecord[];
  settings: Record<string, unknown>;
  expiresAt: number;
};

const TTL_MS = Number(process.env.STATE_CACHE_TTL_MS) || 2000;
const cache = new Map<string, RawState>();

export function getRawState(orgId: string): RawState | null {
  const entry = cache.get(orgId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(orgId);
    return null;
  }
  return entry;
}

export function setRawState(orgId: string, records: AppRecord[], settings: Record<string, unknown>) {
  cache.set(orgId, { records, settings, expiresAt: Date.now() + TTL_MS });
}

export function invalidateState(orgId: string) {
  cache.delete(orgId);
}
