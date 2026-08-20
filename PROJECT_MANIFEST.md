# DOCTYPE OS — Manifesto do projeto

## Aplicação
O repositório é a fonte de código do DOCTYPE OS interno.

## Arquivos do MVP
- `index.html` — shell da aplicação
- `app.css` — identidade visual e responsividade
- `app.js` — regras de negócio, CRUD, dashboard, persistência, backup e DOC Monitor
- `assets/doctype-logo.png` — ativo visual DOCTYPE
- `assets/doc-mascote.png` — mascote DOC
- `README.md` — instruções e escopo
- `CODEX_PROMPT.md` — briefing completo para o Codex

## Validação exigida
- `node --check app.js`
- self-test em `index.html?selftest=1`
- teste E2E das jornadas principais antes de produção
- não alegar E2E aprovado sem execução real

## Regra de produto
Uso exclusivamente interno da DOCTYPE. Não implementar funil comercial, leads, propostas ou follow-up.
