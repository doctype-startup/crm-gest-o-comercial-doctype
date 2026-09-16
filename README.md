# DOCTYPE OS — Gestão Interna e SaaS multi-empresa

Sistema operacional de gestão da DOCTYPE, hoje também vendido como produto SaaS para outras agências: cada empresa cliente é uma organização com dados 100% isolados, com autenticação própria, permissões, auditoria e persistência real em PostgreSQL. A própria DOCTYPE opera como a primeira organização do sistema (Admin SaaS Mestre) e usa o mesmo produto internamente.

> Deploy de produção configurado para Vercel com preset Next.js.

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
- Configurações: meta, usuários, permissões por módulo, senha, exportação e restauração de backup.
- Notificações: central dentro da plataforma (sino no topo) + e-mail (Resend) — hoje dispara quando uma fatura de cliente é paga, para quem tem permissão de ver Financeiro.

O módulo "DOC CRM" (comercial interno de cada empresa cliente) não possui funil de leads, propostas ou follow-up — é só acompanhamento de MRR/margem dos próprios planos vendidos por aquela empresa.

## Modelo SaaS multi-empresa

- **Admin SaaS Mestre** (`/os`, menu "Admin SaaS", exclusivo de quem tem `isSaasMaster=true`): a DOCTYPE provisiona manualmente uma nova empresa cliente (organização, administrador, plano, preço) e acompanha MRR contratado, inadimplência e conversão de testes.
- **Cadastro público self-service** (`/cadastro`): qualquer agência cria sua própria conta sem intervenção da DOCTYPE — escolhe um plano (Start/Smart/Pro, preços em `src/lib/plan-catalog.ts`), informa os dados da empresa e já entra logada como `CEO_ADMIN` da própria organização, em status "Teste". O plano Enterprise continua sob consulta comercial, sem self-service.
- **Cobrança automática via Stripe** (`/os` → "Minha assinatura", `src/lib/stripe-billing.ts`): o próprio `CEO_ADMIN` de cada empresa ativa a cobrança recorrente escolhendo Pix Automático, Cartão de crédito ou Boleto na página segura da Stripe — as próximas mensalidades são cobradas automaticamente no mesmo método. Assim que a primeira cobrança é confirmada pelo webhook, a empresa sai de "Teste" para "Ativo" sozinha, sem intervenção manual. "Transferência" continua sendo só um rótulo administrativo (sem cobrança automatizada).
- **Isolamento multi-tenant**: toda tabela de negócio é filtrada por `org_id` derivado da sessão autenticada, nunca de input do cliente. Coberto por `tests/e2e/tenant-isolation.spec.ts` (provisiona duas empresas e confirma que uma não lê, edita nem apaga dado da outra).

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

## Cobrança automática (Stripe) em produção

Sem `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` configuradas, o sistema continua funcionando normalmente — só o botão "Ativar cobrança automática" em "Minha assinatura" fica desabilitado e `/api/webhooks/stripe` responde `503` sem processar nada (fail closed, nunca cobra sem querer).

1. No Dashboard da Stripe, copie a chave secreta (`sk_test_...` em teste, `sk_live_...` em produção) para `STRIPE_SECRET_KEY`.
2. Ative Pix, Cartão de crédito e Boleto nas formas de pagamento da conta Stripe (Configurações → Métodos de pagamento) — sem isso o checkout falha com uma mensagem específica dizendo qual método não está ativo.
3. Crie um endpoint de webhook apontando para `https://<seu-domínio>/api/webhooks/stripe`, escutando pelo menos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`, `invoice.payment_action_required`, `customer.subscription.updated`, `customer.subscription.deleted`.
4. Copie o "Signing secret" desse endpoint para `STRIPE_WEBHOOK_SECRET`.

O webhook é o único lugar que atualiza status de pagamento, método usado e que promove uma empresa de "Teste" para "Ativo" automaticamente — sem ele configurado corretamente, uma cobrança pode ser aprovada na Stripe sem nunca refletir no DOC.OS.

## Notificações por e-mail (Resend)

Sem `RESEND_API_KEY` configurada, o sistema continua funcionando normalmente — a notificação continua sendo criada na central dentro da plataforma (sino no topo, em qualquer tela), só o e-mail deixa de ser enviado (fail closed, nunca derruba a operação por causa de e-mail).

1. Crie uma conta em [resend.com](https://resend.com) e gere uma API key (Settings → API Keys) para `RESEND_API_KEY`.
2. Opcional, mas recomendado em produção: em Domains, adicione e verifique o domínio de onde os e-mails devem sair (registros SPF/DKIM), e configure `NOTIFICATIONS_FROM_EMAIL` com um remetente desse domínio (ex.: `DOCTYPE OS <notificacoes@seudominio.com.br>`). Sem domínio verificado, o remetente padrão (`onboarding@resend.dev`) só entrega para o e-mail da própria conta Resend — suficiente para testar, não para uso real com clientes.

Hoje o único evento que dispara notificação é uma fatura de cliente confirmada como paga (`src/app/api/webhooks/stripe/route.ts`) — todos os usuários ativos da organização com permissão de leitura no módulo Financeiro (papel ou exceção individual, ver `src/lib/notifications.ts`) recebem a notificação na central e por e-mail. Novos eventos (tarefa atrasada, renovação próxima, 2FA pendente etc., hoje só visíveis no DOC Monitor) podem reutilizar `notifyUsers()`/`usersWithModuleAccess()` da mesma forma.
