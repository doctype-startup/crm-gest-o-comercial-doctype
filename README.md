# DOCTYPE OS — Gestão Interna

Versão de produção do sistema operacional interno da DOCTYPE. O projeto substitui o MVP em `localStorage` por uma aplicação multiusuário com autenticação, banco compartilhado, permissões, auditoria e persistência real.

## O que está implementado

- Dashboard executivo: MRR, clientes ativos, valores a receber, inadimplência, tarefas e alertas.
- Clientes 360°: contrato, serviços, mensalidade, vencimento, renovação, responsável, saúde e observações.
- Acessos: plataforma, login, usuário/ID, URL, 2FA, responsável, status e referência ao cofre. Não há campo de senha.
- Financeiro: faturas, receitas, despesas, recebimentos e resultado gerencial.
- Operação: tarefas, prioridades, prazos, responsáveis e status.
- Renovações: calendário e alertas D-30, D-15, D-7 e D0.
- DOC CRM: Start, Smart, Pro e Legado; MRR, setup, custos, margem e meta.
- Equipe: integrantes, papéis, responsabilidades e custo.
- DOC Monitor: alertas calculados a partir de exceções reais da operação.
- Configurações: meta, usuários, permissões, senha, exportação e restauração de backup.

O sistema não possui funil de leads, propostas ou follow-up comercial.

## Segurança e multiusuário

- Sessões aleatórias de 256 bits, armazenadas no navegador apenas em cookie `HttpOnly`, `SameSite=Strict` e `Secure` em produção.
- Tokens armazenados no banco somente como SHA-256 e senhas protegidas com Argon2id.
- RBAC para `CEO_ADMIN`, `OPERATIONS` e `FINANCE` aplicado na interface e novamente em todas as APIs.
- Isolamento por organização (`org_id`) em toda consulta e mutação.
- Validação Zod no servidor, proteção de origem em mutações e limite de tentativas de login.
- Log de auditoria para login, criação, edição, exclusão, senha, usuários, configurações e backup.
- Exclusão de cliente remove, após confirmação explícita, os registros operacionais vinculados.
- Cabeçalhos de segurança e endpoint de saúde do banco em `/api/health`.

## Banco de dados

Produção usa PostgreSQL. Desenvolvimento e testes podem usar SQLite local. A estrutura é criada de forma idempotente na primeira inicialização.

1. Copie `.env.example` para `.env.local`.
2. Configure o PostgreSQL e as credenciais do primeiro administrador.
3. Execute `npm run seed` uma vez, ou deixe a aplicação criar o primeiro acesso.
4. Depois do primeiro login, troque a senha provisória.

Nunca use SQLite em produção. A aplicação bloqueia essa configuração, exceto quando `ALLOW_SQLITE_IN_PRODUCTION=true` é informado explicitamente para testes de build.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Sem `.env.local`, o desenvolvimento usa `admin@doctype.local` e a senha provisória `Doctype@2026`. Essas credenciais não são aceitas como padrão em produção.

## Validação

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Os testes cobrem permissões, validações, isolamento entre organizações, auditoria, DOC Monitor, botões e modais, API HTTP, CRUD com persistência, login, backup e jornadas reais em desktop e viewport mobile.

## Publicação

Configure as variáveis de `.env.example` na hospedagem e publique a aplicação Next.js. O build gera saída `standalone`, compatível com Vercel ou container Node. O banco PostgreSQL precisa aceitar conexões SSL da aplicação.

Antes de liberar acesso, confirme:

- PostgreSQL configurado e `/api/health` respondendo `healthy`;
- senha provisória do primeiro administrador trocada;
- usuários de Operação e Financeiro criados com permissões mínimas;
- backup inicial exportado e guardado em local seguro;
- política interna LGPD definida para retenção e exclusão de dados.
