# DOCTYPE OS — Manifesto técnico

## Aplicação

Produto SaaS multi-empresa da DOCTYPE em Next.js 16, React 19, TypeScript, Kysely e PostgreSQL. SQLite existe somente para desenvolvimento e testes. Cada empresa (tenant) é uma `organization` isolada por `org_id`; a DOCTYPE opera sua própria organização como Admin SaaS Mestre e vende o mesmo sistema para outras agências como cliente pagante — ver "Modelo SaaS multi-empresa" abaixo.

## Estrutura principal

- `src/app/` — páginas, autenticação e APIs.
- `src/app/cadastro/` — cadastro público self-service de novas empresas clientes.
- `src/components/` — interface DOCTYPE OS e jornadas interativas.
- `src/lib/` — banco, autenticação, RBAC, validação, registros, auditoria, DOC Monitor e billing SaaS (`saas.ts`, `plan-catalog.ts`, `stripe.ts`, `stripe-billing.ts`).
- `assets/` — logo DOCTYPE e mascote DOC originais.
- `tests/` — regras, banco, interface e E2E desktop/mobile, incluindo isolamento multi-tenant (`tests/e2e/tenant-isolation.spec.ts`).
- `scripts/` — seed, smoke HTTP e preparação do navegador de CI.

## Modelo SaaS multi-empresa

- Toda empresa cliente (incluindo a própria DOCTYPE) é uma `organization` com dados 100% isolados por `org_id` — nenhuma tabela de negócio é compartilhada entre empresas.
- Provisionamento de uma nova empresa acontece de duas formas: (1) manualmente pelo Admin SaaS Mestre (`saas-admin.tsx`, papel `isSaasMaster` + `CEO_ADMIN`), ou (2) self-service pela própria empresa em `/cadastro`, sem intervenção da DOCTYPE.
- Cobrança recorrente automática via Stripe (Pix Automático, Cartão de crédito e Boleto) — ver `src/lib/stripe-billing.ts` e `src/app/api/billing/checkout/route.ts`. "Transferência" continua sendo só um rótulo administrativo, sem cobrança automatizada.
- O papel `isSaasMaster` (tabela `platform_admins`) é exclusivo da organização da própria DOCTYPE e não concede acesso aos dados operacionais de nenhuma outra empresa — só à tela de provisionamento/faturamento (`/api/admin/organizations`).

## Regras preservadas

- Nenhuma senha de cliente é armazenada.
- Todos os dados são persistidos no banco compartilhado e isolados por organização.
- Todos os botões visíveis possuem comportamento funcional e são cobertos por testes de interface ou E2E.
