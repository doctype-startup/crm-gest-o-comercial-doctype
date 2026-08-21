# DOCTYPE OS — Manifesto técnico

## Aplicação

Sistema interno da DOCTYPE em Next.js 16, React 19, TypeScript, Kysely e PostgreSQL. SQLite existe somente para desenvolvimento e testes.

## Estrutura principal

- `src/app/` — páginas, autenticação e APIs.
- `src/components/` — interface DOCTYPE OS e jornadas interativas.
- `src/lib/` — banco, autenticação, RBAC, validação, registros, auditoria e DOC Monitor.
- `assets/` — logo DOCTYPE e mascote DOC originais.
- `tests/` — regras, banco, interface e E2E desktop/mobile.
- `scripts/` — seed, smoke HTTP e preparação do navegador de CI.

## Regras preservadas

- Uso exclusivamente interno.
- Sem CRM comercial, funil, propostas ou follow-up.
- Nenhuma senha de cliente é armazenada.
- Todos os dados são persistidos no banco compartilhado e isolados por organização.
- Todos os botões visíveis possuem comportamento funcional e são cobertos por testes de interface ou E2E.
