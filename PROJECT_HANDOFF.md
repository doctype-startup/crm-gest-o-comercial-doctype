# DOC.OS — Handoff técnico e continuidade

Atualizado em: 15/09/2026

## Datas em pt-BR e cliente de teste manual (15/09/2026)

Todos os campos de data editáveis do CRM (Clientes 360°, Financeiro, Operação,
DOC CRM e a Gestão Comercial — Orçamentos/Contratos) usavam `<input type="date">`
nativo, que segue o idioma configurado no **sistema operacional do navegador**, não o
`lang="pt-BR"` da página — em máquinas com o navegador/SO em outro idioma isso mostrava
o campo em `mm/dd/aaaa` mesmo com o app inteiro em português. Criado
`src/components/date-field.tsx`: input de texto mascarado (`dd/mm/aaaa`) que converte
para o formato ISO (`aaaa-mm-dd`) já usado para armazenar e exibir datas — garante o
mesmo formato de preenchimento em qualquer navegador/SO. Substituído em todos os pontos
que tinham `type="date"`: `doctype-os.tsx` (Clientes/Financeiro/Operação/DOC CRM, via
`FieldControl`), `commercial-suite.tsx` (Orçamentos/Contratos, via `Field`) e
`saas-admin.tsx` (Admin SaaS Mestre: renovação, próxima cobrança, prazo de
regularização). De caminho, a tabela de Orçamentos/Contratos exibia datas em ISO cru
sem formatar — agora usa `toLocaleDateString("pt-BR")` como o resto do app.

Testado manualmente (Playwright, local, SQLite) em desktop e mobile: máscara ao digitar,
persistência, recarregamento correto do valor ao reabrir para edição.

**Admin SaaS Mestre — cliente de teste manual:** adicionado um campo booleano
`is_test_client` em `saas_accounts` (migração idempotente via `alterTable` em
`createSchema()`, já que a tabela existia antes — `createTable().ifNotExists()` não
adiciona coluna a tabela já existente). Um checkbox "Cliente de teste manual" no
formulário de empresa marca isso, independente do `status` de cobrança
(Teste/Ativo/Suspenso/Cancelado) que já existia — serve para o time interno sinalizar
manualmente que uma conta é de teste, sem mexer no ciclo de cobrança real. Aparece como
badge roxo "Teste manual" no card da empresa.

**Pendente (fora do escopo desta rodada):** ajuste de alinhamento na frase "Acessos dos
clientes" pedido pelo usuário — não foi possível localizar visualmente o problema sem um
print específico da tela; aguardando confirmação.

## Webhook em modo live com assinatura desatualizada (15/09/2026)

Com o checkout de produção funcionando (Cartão/Boleto), o webhook (`POST
/api/webhooks/stripe`) passou a responder `400` para todo evento — a Stripe já tinha um
endpoint live ativo ("dynamic-voyage", 100% de taxa de erro), mas o `STRIPE_WEBHOOK_SECRET`
salvo na Vercel não batia com o signing secret real desse endpoint (provavelmente ficou
com o valor de uma rodada anterior de configuração, sandbox ou não). Corrigido colando o
signing secret certo desse endpoint. Como não é possível confirmar sem testar se a Vercel
propaga env vars pra instâncias já quentes sem um novo deploy (mesmo problema documentado
antes para `STRIPE_SECRET_KEY`), forçando um redeploy por precaução — commit também serve
pra isso.

## Ida para produção (Pix + Cartão) e cliente de cache do Stripe (15/09/2026)

Depois de validar Pix/Cartão no sandbox, a PR #17 foi mesclada em `main` com o Boleto
pausado (`AUTOMATED_PAYMENT_METHOD_TYPES` sem "boleto", volta a incluir quando resolvido)
para liberar cobrança real a um cliente. Na primeira tentativa em produção, o checkout
seguia recusando com `Invalid API Key provided: sk_test_...` mesmo com a
`STRIPE_SECRET_KEY` de Production já corrigida para a chave `sk_live_...` no painel da
Vercel — porque `src/lib/stripe.ts` guarda o cliente Stripe num singleton por instância
da function (`client ??= new Stripe(key, ...)`), então instâncias "quentes" que já
tinham inicializado o cliente com a chave antiga continuam usando-a até a instância
reciclar ou um novo deploy forçar instâncias novas. **Lição:** depois de trocar
`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`, sempre forçar um novo deploy (não basta
salvar a variável) antes de testar de novo.

Na sequência, o erro mudou para `Invalid API Key provided: whsec_...` — o valor de
`STRIPE_WEBHOOK_SECRET` tinha sido colado por engano no campo `STRIPE_SECRET_KEY`
(dois campos parecidos, fácil de trocar ao configurar os dois ao mesmo tempo).
Corrigido restaurando a chave `sk_live_...` correta nesse campo.

**Causa raiz final, bug real de robustez no código:** com a chave `sk_live_` correta
finalmente no ar, o erro virou `No such customer: 'cus_...'`. Cada vez que uma chave
Stripe diferente esteve ativa durante essa sequência de correções (test → live →
webhook secret por engano → live certa), qualquer tentativa de checkout que chegasse a
criar um Cliente Stripe gravava esse ID em `saas_billing.external_customer_id` — só que
esse Cliente só existe na conta/chave que estava ativa no momento da criação. Ao trocar
de chave, o ID salvo vira uma referência órfã. `src/app/api/billing/checkout/route.ts`
agora confirma que o `external_customer_id` salvo ainda existe na conta atual
(`stripe.customers.retrieve`) antes de reaproveitá-lo — se a Stripe responder
`resource_missing`, cria um Cliente novo e atualiza o registro, em vez de deixar o
checkout inteiro quebrar. Isso protege contra qualquer troca futura de chave/conta,
cliente deletado manualmente no dashboard, etc., não só o caso desta rodada.

**Pix pausado em produção:** com o customer órfão resolvido, o próximo erro foi
`payment method type provided: pix is invalid`. Diferente do Boleto no sandbox (que
estava "Enabled" mas com capacidade pausada por pendência cadastral), o Pix **nem
aparece** na lista de métodos de pagamento da conta Stripe de produção (só Cards, Apple
Pay, Google Pay, Link e Boleto estão listados, todos habilitados) — é uma limitação de
elegibilidade da conta para esse método específico, não algo resolvível por configuração
ou código. Endereço da conta confirmado como Brasil (Curitiba/PR), então a causa provável
é uma aprovação/capacidade específica do Pix ainda pendente com a Stripe — segue como
pendência para o usuário resolver diretamente com o suporte da Stripe.

Para não travar o teste do cliente enquanto isso não é resolvido, `pix` foi removido de
`AUTOMATED_PAYMENT_METHOD_TYPES` (mesmo padrão usado para pausar o Boleto antes) — o
checkout de produção agora oferece **Cartão + Boleto** (ambos confirmados habilitados na
conta). Basta devolver `"pix"` à lista assim que a Stripe confirmar a ativação, sem
mexer em mais nada. Cópia visual (`subscription-view.tsx`, `signup-form.tsx`) e o ícone
da seção de cobrança automática (trocado de `QrCode` para `Wallet`) atualizados para não
mencionar mais Pix como opção disponível.

**Alerta de possível mistura de contas Stripe:** ao investigar a ausência do Pix, o
Account ID da conta consultada (`acct_1U89n6QcGptRE0X3`) parece corresponder ao prefixo
de uma chave publicável (`pk_live_51U89n6...`) diferente da chave secreta configurada na
Vercel (`sk_live_51H8a...`) — mesmo padrão de troca de conta que já apareceu várias vezes
nesta rodada (sandbox errado, chave test vs. live). Não foi confirmado se são a mesma
conta ou contas diferentes; antes de abrir qualquer chamado com o suporte da Stripe sobre
o Pix, **confirmar primeiro que a verificação foi feita na conta certa** (a mesma de onde
saiu a chave `sk_live_51H8a...` usada pelo CRM).

## Teste ao vivo contra a Stripe real — 4 bugs de checkout corrigidos (15/09/2026)

Depois da rodada anterior (documentação + Cartão/Boleto + cadastro self-service), o usuário ativou a conta Stripe (saiu do modo restrito) e testamos "Ativar cobrança automática" de ponta a ponta pela primeira vez contra a Stripe de verdade (sandbox/test mode). Nenhum desses 4 problemas aparecia nos testes locais (SQLite, sem Stripe real) — só surgiram testando ao vivo:

1. **`payment_method_options[pix][mandate_options][currency]` inválido em `mode="subscription"`** — a Stripe infere a moeda dos line items; passar `currency` explicitamente é rejeitado. Bug pré-existente na implementação original só-Pix, nunca pego antes.
2. **Chave idempotente presa por 1 dia inteiro** — `checkoutIdempotencyKey` era determinística por dia (org+plano+preço+ciclo+dia). A tentativa que falhou com o bug do `currency` "gravou" essa chave na Stripe; a tentativa seguinte, já corrigida, colidia com ela (`StripeIdempotencyError`, parâmetros diferentes da primeira vez). Reduzido o bucket de determinismo para 1 minuto — só o suficiente pra evitar duplo-clique/retry de rede, sem travar o dia inteiro após qualquer falha.
3. **`payment_method_options[pix][mandate_options][reference]` também inválido em `mode="subscription"`** — mesmo motivo do `currency`: só `amount` e `payment_schedule` são aceitos ali, confirmado na documentação da Stripe.
4. **Boleto "Enabled" na tela geral de Payment Methods, mas API seguia recusando** ("payment method type provided: boleto is invalid"). Causa: o código especifica `payment_method_types` manualmente, e isso faz a Stripe validar contra a ativação "crua" da conta — não contra uma **Payment Method Configuration nomeada** do dashboard (Settings → Billing → Invoice settings → "Métodos de pagamento padrão", ID `pmc_...`), que é onde o Boleto dessa conta estava de fato ativado para faturas/assinaturas. A Stripe recomenda não misturar os dois. Adicionada `STRIPE_PAYMENT_METHOD_CONFIGURATION` (opcional): quando definida, o checkout usa essa configuração nomeada como fonte única da verdade de quais métodos oferecer, em vez da lista fixa no código.

**Lição pro futuro:** qualquer coisa envolvendo `payment_method_options` de métodos assíncronos (Pix, Boleto) em `mode="subscription"` precisa ser validada contra a Stripe real antes de dar como pronta — os testes locais e o SDK TypeScript não pegam essas restrições (os campos existem no tipo, só são rejeitados em runtime pela API).

**Ainda em aberto ao encerrar esta rodada:** confirmar que a `STRIPE_PAYMENT_METHOD_CONFIGURATION` com Pix/Cartão/Boleto todos ativos resolve o Boleto sem regredir o Pix (que não aparecia listado nessa configuração nomeada, mas funcionava via `payment_method_types` explícito). Também notamos, mais de uma vez, redeploys acidentais de **produção** (branch `main`, código antigo) ao tentar redeployar o preview do PR pela UI da Vercel — terminamos preferindo forçar um novo Preview via commit no branch em vez de depender do botão "Redeploy" da Vercel.

**Causa raiz do Boleto confirmada via log de diagnóstico:** adicionamos um log temporário em `stripeErrorResponse()` expondo `process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION` a cada falha de checkout. O log confirmou `"(não definida)"` mesmo depois do usuário ter cadastrado a variável na Vercel — ou seja, a variável nunca chegou ao runtime do deployment de Preview testado. Causa mais provável: variável salva no painel da Vercel só para o ambiente **Production**, sem marcar **Preview** (onde os testes ao vivo aconteciam). Usuário corrigiu o escopo da variável; o log seguinte confirmou o valor chegando certo, mas revelou um segundo erro: `resource_missing — No such payment_method_configuration` (a configuração nomeada `pmc_...` tinha sido criada fora da sandbox de teste usada pela chave `sk_test_...` da conta).

**Causa raiz real, anterior a tudo isso:** a conta Stripe (sandbox DOCTYPE) tinha uma tarefa cadastral pendente/vencida que deixava **"Multiple capabilities paused"** — isso por si só já explicava o Boleto (e potencialmente outros métodos) serem recusados como "invalid" mesmo aparecendo "Enabled" na tela de Payment Methods. Usuário atualizou o cadastro pendente, `Account status` voltou para `Active (Payments, Payouts)`. Com a conta liberada, removemos a variável `STRIPE_PAYMENT_METHOD_CONFIGURATION` (não é mais necessária) para voltar a usar a lista fixa `["pix", "card", "boleto"]` direto na conta, evitando depender de uma configuração nomeada específica de sandbox.

**Causa raiz definitiva:** mesmo com Boleto confirmadamente "Habilitado" (com suporte a recorrência) na sandbox "DOCTYPE sandbox", o erro persistia idêntico. Comparando o prefixo da `STRIPE_SECRET_KEY` configurada na Vercel com o da sandbox onde o usuário estava configurando tudo, eram **contas/sandboxes Stripe diferentes** (`sk_test_51U88yAIi5p9SjLrF...` na Vercel vs. `sk_test_51U89nUHRkUxBmChi...` na "DOCTYPE sandbox"). O app nunca esteve conversando com a conta que estava sendo configurada. Corrigido: `STRIPE_SECRET_KEY` atualizada na Vercel para a chave da "DOCTYPE sandbox"; webhook recriado dentro dessa mesma sandbox (Developers → Webhooks) e `STRIPE_WEBHOOK_SECRET` atualizado com o novo `whsec_...`. Redeploy forçado para validar — confirmação em andamento.

**Lição pro futuro:** ao depurar contra Stripe sandbox, sempre confirmar que a `STRIPE_SECRET_KEY` do ambiente testado pertence à mesma sandbox sendo configurada na dashboard — o prefixo após `sk_test_51` identifica a conta. Duas sandboxes "parecidas" (mesmo nome de negócio, mesmo modo de teste) podem ser contas totalmente distintas.

**Erro extra no meio da correção:** na primeira tentativa de atualizar `STRIPE_SECRET_KEY` na Vercel, o valor salvo acabou sendo literalmente o texto `"STRIPE_SECRET_KEY"` (o nome da variável, não o valor) — a Stripe recusou com `StripeAuthenticationError: Invalid API Key provided: STRIPE_S*****_KEY`, um erro bem diagnosticável pelo próprio formato da mensagem. Corrigido colando o valor correto isoladamente.

## Documentação alinhada ao código real + Cartão/Boleto + cadastro self-service (15/09/2026)

Ao retomar o projeto, a documentação (`README.md`, `PROJECT_HANDOFF.md`, `PROJECT_MANIFEST.md`) descrevia o DOC.OS como **uso exclusivamente interno da DOCTYPE, sem CRM comercial/funil/follow-up** — mas o código em `main` já tinha, funcional e conectado desde as rodadas de `feat: add DOCTYPE SaaS master admin` e `feat: add SaaS plans and subscription billing` (ver histórico do Git): Admin SaaS Mestre (`saas-admin.tsx`), cobrança recorrente real via Stripe (`stripe-billing.ts`) e isolamento multi-tenant já testado (`tests/e2e/tenant-isolation.spec.ts`). Ou seja, o DOC.OS já era vendido como SaaS multi-empresa na prática, só a documentação nunca foi atualizada para refletir isso. Esta rodada:

1. **Auditoria de isolamento multi-tenant do billing** (sem achados): toda rota de billing/admin usa `session.orgId` ou é gated por `isSaasMaster + CEO_ADMIN`; o webhook da Stripe resolve `org_id` só a partir dos dados assinados do próprio evento (metadata/lookup por `external_subscription_id`/`external_customer_id`), nunca de input do cliente. `tests/e2e/tenant-isolation.spec.ts` já cobre o cenário de uma empresa tentar ler/editar/apagar dado de outra (todas as tentativas retornam 404).
2. **Cartão de crédito e Boleto somados ao Pix Automático** no checkout (`src/app/api/billing/checkout/route.ts`, `src/lib/stripe-billing.ts`): antes só `payment_method_types: ["pix"]`; agora `["pix", "card", "boleto"]` na mesma sessão de checkout Stripe (`mode=subscription"`), com `expires_after_days` para o boleto. O método de pagamento salvo em `saas_billing.payment_method` deixou de ser fixo em `"Pix"` no webhook — agora é resolvido de verdade consultando `subscription.default_payment_method` na Stripe (`billingMethodFromStripeType`). UI de "Minha assinatura" generalizada de "Pix Automático" para "Cobrança automática" (classes CSS `pix-automatico`/`pix-icon`/`pix-active` renomeadas para `billing-activation*`).
3. **Cadastro público self-service** (`/cadastro`, `src/app/api/public/signup/route.ts`, `src/lib/plan-catalog.ts`): antes só o Admin SaaS Mestre conseguia criar uma empresa cliente nova. Agora qualquer agência cria a própria conta sem intervenção da DOCTYPE, escolhendo entre os planos Start (R$ 197/mês, 3 usuários), Smart (R$ 397/mês, 8 usuários) e Pro (R$ 697/mês, 20 usuários) — preços/limites centralizados em `plan-catalog.ts`, fáceis de ajustar num só lugar. Enterprise continua sob consulta, sem self-service. A conta nasce em status `"Teste"` e a sessão já é criada automaticamente (reaproveita `authenticate()`, sem duplicar lógica de sessão). Throttling por IP reaproveita a mesma tabela `login_rate_limits` do login (`registerRateLimitAttempt`, extraído de `registerLoginFailure`), sem tabela nova.
4. **Fechamento do loop Teste → Ativo**: o webhook da Stripe agora promove `saas_accounts.status` de `"Teste"` para `"Ativo"` automaticamente assim que a primeira cobrança é confirmada (`checkout.session` pago ou `invoice.payment_succeeded`/`invoice.paid`) — antes esse campo nunca mudava sozinho, então uma empresa self-service pagante ficaria com o selo "Teste" para sempre até um admin mexer manualmente.
5. **Variáveis `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` documentadas** em `.env.example` e no README (nunca estiveram documentadas antes, apesar de o código já depender delas desde a rodada de billing original).

**Validado nesta rodada:** `npm run lint`, `npm run typecheck`, `npm test` (21 testes) e `npm run build` (com `ALLOW_SQLITE_IN_PRODUCTION=true`, mesmo padrão do CI) — todos verdes. Testado manualmente de ponta a ponta contra um SQLite local rodando a build de produção: cadastro público cria empresa+admin+billing e already loga (sessão funcional via `/api/billing`), e-mail duplicado rejeitado (409), senha fraca rejeitada (400, mensagens de campo), plano `Enterprise` rejeitado no self-service (400, só Start/Smart/Pro), `/api/billing/checkout` e `/api/webhooks/stripe` degradam para `503` sem Stripe configurada (fail closed).

**Não testado nesta rodada (pendente, ver "Testes exigidos antes de qualquer merge em `main`" abaixo):** fluxo real contra a Stripe em modo teste (checkout de verdade com Pix/Cartão/Boleto sandbox + webhook assinado de verdade) — este ambiente não tinha `STRIPE_SECRET_KEY` de teste disponível. `npm run test:e2e` (Playwright) não foi executado nesta rodada. Antes de considerar o cadastro self-service pronto para tráfego real, também vale avaliar: (a) proteção anti-abuso além do rate-limit por IP (hoje sem captcha/verificação de e-mail), (b) se o self-service deveria exigir confirmação de e-mail antes de liberar acesso.

## Escala para 1000 usuários simultâneos (27/08/2026)

Revisão fullstack identificou que `/api/state` (lido a cada 3s por usuário pelo DOC
Monitor) buscava todos os registros da organização sem cache, com pool de Postgres
fixo em 10 conexões, sem controle de concorrência em `updateRecord` e com contratos/
logos guardados como base64 na mesma tabela `records` lida a cada poll. Mudanças desta
sessão, todas aditivas e compatíveis com o comportamento anterior quando as novas
variáveis de ambiente não são configuradas:

- `src/lib/state-cache.ts` + `src/lib/state.ts`: micro-cache em memória (TTL
  `STATE_CACHE_TTL_MS`, padrão 2s) do estado bruto por organização, invalidado
  imediatamente em toda gravação (`invalidateState`, chamado de `records.ts`,
  `api/settings` e `api/backup`). Nenhum usuário vê dado desatualizado após a própria
  escrita.
- `src/app/api/state/route.ts`: suporte a `ETag`/`If-None-Match` (304 quando nada
  mudou). O ETag inclui o dia UTC corrente propositalmente — alertas do DOC Monitor
  mudam só pela passagem do dia (princípio já documentado abaixo), então a virada do
  dia sempre força recálculo, nunca fica presa num 304 do dia anterior.
- `src/components/realtime-monitor.tsx`: `loadState` agora envia `If-None-Match` e
  trata 304 sem tocar em `records`/`signature` (mantém o fluxo único de estado ao vivo
  já documentado nesta seção do arquivo).
- `src/lib/db.ts`: `max` do pool do Postgres configurável via `DATABASE_POOL_MAX`
  (padrão 5 fora do pooler da Supabase). Ainda recomendado usar um pooler de
  transação (PgBouncer/Supabase Pooler/Neon pooled) em produção com muitas instâncias.
- `src/lib/records.ts`: `updateRecord` aceita `expectedUpdatedAt` opcional — se o
  cliente enviar o `updatedAt` que tinha em tela e ele não bater mais com o do banco,
  a API responde 409 em vez de sobrescrever silenciosamente a edição de outra pessoa.
  `doctype-os.tsx` e `commercial-suite.tsx` já enviam esse campo.
- `src/lib/blob-storage.ts`: quando `BLOB_READ_WRITE_TOKEN` está definido, arquivos
  grandes (`clients.logoDataUrl`, `clients.contractFile.dataUrl`,
  `contracts.fileDataUrl`) saem da tabela `records` e vão para o Vercel Blob — só a
  URL fica no registro. Sem o token, nada muda.

Pendente (não feito nesta sessão, ver revisão fullstack completa para detalhes):
paginação em `/api/records` e no backup; mover filtros usados na exclusão em cascata
e no cálculo de métricas para dentro do banco; teste de carga automatizado.

## Repositório e produção
- Repositório oficial: `doctype-startup/crm-gest-o-comercial-doctype`
- Branch de produção: `main`
- Projeto Vercel: `doctype-os-gestao`
- O código versionado no GitHub é a fonte de verdade do sistema.
- Antes de trabalhar, conferir o HEAD atual de `main`, o último CI verde e o deployment Vercel correspondente.
- Estado validado ao encerrar a sessão de 23/08/2026: PR #13 mergeada e produção Vercel `success`.
- Commit funcional de produção validado: `f1d4a781c9bee9381223263104621606f8585292`.

## Objetivo do sistema
DOC.OS é o CRM/ERP da DOCTYPE Tecnologia e Marketing, operado internamente e também vendido como produto SaaS multi-empresa para outras agências (ver "Documentação alinhada ao código real..." acima). Centraliza gestão comercial, clientes, financeiro, operação, DOC CRM, equipe, renovações, configurações e monitoramento inteligente pelo DOC Monitor — o mesmo conjunto de módulos para toda empresa cliente, isolado por organização.

## Identidade e UX obrigatórias
- Produto: `DOC.OS`
- Empresa/marca-mãe: DOCTYPE
- Visual: premium, tecnológico, escuro, azul-marinho + laranja DOCTYPE.
- Não redesenhar nem alterar a logo oficial DOCTYPE.
- Evitar páginas claras/brancas fora do padrão visual do sistema.
- Navegação deve usar o mesmo shell/topbar/sidebar em todos os módulos.
- Apenas um item do menu pode ficar ativo por vez.
- Desktop e mobile devem funcionar integralmente.
- Nenhum hover/focus pode esconder texto, ícone ou valor por conflito de contraste.

## Módulos existentes
- Visão Geral
- Clientes 360°
- Acessos
- Financeiro
- Operação
- Renovações
- DOC CRM
- Equipe
- DOC Monitor
- Configurações
- Produtos
- Orçamentos
- Contratos
- Minha assinatura (billing da própria empresa cliente)
- Admin SaaS (exclusivo de `isSaasMaster`, provisionamento/faturamento de outras empresas)

## Persistência e arquitetura
- Registros usam a tabela compartilhada `records`.
- Segregação multiempresa por `org_id`.
- Produtos, Orçamentos e Contratos não criam banco paralelo.
- `src/lib/state.ts` monta o estado autorizado por função e é a fonte de leitura do frontend via `/api/state`.
- O DOC Monitor é consumidor do estado autorizado: não grava, edita nem exclui dados operacionais.
- Permissões existentes devem continuar sendo respeitadas. O monitor nunca pode contornar `canRead`/`canWrite`.

## Gestão comercial
### Produtos
Campos incluem nome, SKU/código, categoria, descrição, preço de venda, custo, unidade, tipo de cobrança, status e observações.

### Clientes ↔ Produtos
Clientes 360° possui `productIds` para associar produtos contratados.

### Orçamentos
Número, cliente, título, produtos, subtotal, desconto, total, validade, status e condições/observações.

### Contratos
Número, cliente, orçamento relacionado, título, produtos, valor, início, fim/renovação, data de assinatura, status, upload do contrato assinado e observações.

## DOC Monitor / Guardião — arquitetura de observabilidade
O DOC Monitor funciona como camada de observabilidade do DOC.OS e nunca como estado paralelo do CRM.

### Arquivos principais
- `src/lib/monitor.ts`: alertas operacionais tradicionais.
- `src/lib/monitor-engine.ts`: motor puro de consolidação dos dados do sistema em seções rotativas.
- `src/components/realtime-monitor.tsx`: sincronização, resiliência, termômetros, rotação e distribuição do estado ao vivo.
- `src/components/monitor-state-bridge.tsx`: ponte que injeta no `DoctypeOS` o MESMO `StatePayload` publicado pelo DOC Monitor, inclusive quando alertas mudam sem alteração de `id/updatedAt` dos registros.
- `src/app/realtime-monitor.css`: layout e estados visuais do monitor ao vivo.
- `src/components/doc-monitor-overlay.tsx`: balão flutuante/drawer do Guardião, alimentado pelo mesmo estado ao vivo.
- `src/app/doc-monitor-live.css`: responsividade e estados visuais do balão rotativo.

### Princípios obrigatórios
1. O monitor somente lê os registros autorizados retornados por `/api/state`.
2. O monitor não pode alterar registros, banco ou estado operacional dos outros módulos.
3. Eventos `doctype:records-changed` disparam atualização imediata quando o módulo emissor os publica.
4. Existe reconciliação redundante via polling a cada 3 segundos para cobrir módulos sem evento, alterações multiusuário, passagem do tempo e recuperação de eventos perdidos.
5. Requisições simultâneas são serializadas; se chegar novo evento durante uma leitura, uma nova leitura é enfileirada.
6. Eventos são debounced para evitar tempestade de chamadas.
7. Uma falha de rede não zera o painel: mantém a última leitura válida e sinaliza `RECONECTANDO`.
8. Após 15 segundos sem leitura válida, o painel pode sinalizar `DADOS DESATUALIZADOS`.
9. Ao voltar para uma aba visível, o monitor sincroniza novamente.
10. Toda leitura válida publica `doctype:monitor-state` com o pacote completo `{ records, alerts, settings, user, generatedAt }`.
11. `MonitorStateBridge`, `DocMonitorOverlay` e as superfícies nativas devem consumir esse mesmo pacote ao vivo. Nunca criar um segundo estado de alertas independente.
12. O estado de conexão é publicado em `doctype:monitor-sync` (`live`, `syncing`, `retrying`, `stale`).
13. Quando o polling identifica mudança real nos registros, publica `doctype:records-changed` com `detail.source = "monitor"` para reconciliar componentes que ainda dependem desse evento; o próprio monitor ignora essa origem para impedir loop infinito.
14. O contador do balão NÃO soma tarefas/renovações por fora. Usa exclusivamente `alerts.length` retornado pelo `/api/state`.
15. O ciclo de sincronização deve permanecer montado uma única vez. `lastUpdate`, `syncState` e erro usam refs; mudanças visuais não podem desmontar o efeito nem abortar a própria requisição.
16. Mudanças de alerta decorrentes apenas da passagem do tempo DEVEM aparecer simultaneamente no menu, card nativo, lista, selo e balão mesmo sem `updatedAt` novo no registro.

### Fluxo único de estado ao vivo
Fluxo obrigatório:

`/api/state` → `RealtimeMonitor` → `doctype:monitor-state` → `MonitorStateBridge` + `DocMonitorOverlay` → superfícies do DOC.OS.

Esse fluxo garante que:
- número ao lado de `DOC Monitor`;
- card `X pontos pedem atenção`;
- lista de alertas;
- selo do Guardião;
- texto `X pontos pedindo atenção` no drawer;
- mensagens rotativas do balão;

usem a MESMA leitura válida e mudem juntos.

Não voltar ao modelo anterior em que o balão recebia `doctype:monitor-state`, mas o shell permanecia apenas com `state.alerts` obtido por outra atualização.

### Pontos de atenção em tempo real
- O número exibido no selo do Guardião é dinâmico; não existe valor fixo como `3`.
- Se não houver alertas ativos, o selo não é exibido.
- Ao criar, editar, resolver ou simplesmente atingir um prazo que gere/remova alerta, a contagem deve refletir a nova leitura automaticamente.
- O texto `X pontos pedindo atenção` dentro do drawer deve sempre coincidir com o selo.
- O card nativo `X pontos pedem atenção` e o contador do menu devem usar exatamente o mesmo `alerts.length` do pacote ao vivo.
- O item lateral `DOC Monitor` pode incluir a contagem no nome acessível; testes não devem exigir o nome exato sem considerar esse contador.

### Rotatividade do layout
O painel principal rotaciona automaticamente a cada 7 segundos e também oferece navegação manual entre:
- Pulso do DOC.OS
- Operação e produtividade
- Saúde financeira
- Clientes e renovações
- Comercial
- DOC CRM, equipe e segurança

O balão/drawer do Guardião também rotaciona uma leitura resumida a cada 7 segundos. A mensagem usa somente indicadores derivados do `monitor-engine`; prioriza item crítico, depois atenção, depois o primeiro item disponível da seção.

Cada seção possui quatro indicadores derivados dos registros reais. Não inventar números nem preencher lacunas com estimativas não identificadas.

### Termômetros preservados
Continuam existindo três termômetros:
- Produtividade do dia
- Saúde financeira
- Saúde dos prazos

### Dados monitorados
Conforme permissão do usuário, o motor consolida registros de:
- `clients`
- `accesses`
- `invoices`
- `expenses`
- `tasks`
- `crm`
- `team`
- `products`
- `quotes`
- `contracts`

### Segurança e Guardião
- Asset válido: `public/assets/guardiao-monitor.webp`.
- NÃO usar `public/assets/guardiao-inline.png` (arquivo inválido/corrompido identificado anteriormente).
- O Guardião deve interpretar somente dados calculados a partir do estado real disponível.
- O drawer/balão deve ser responsivo em desktop e mobile; não pode estourar largura, cortar texto ou ocultar o contador.

## Testes do DOC Monitor
Além da suíte existente:
- `tests/monitor-engine.test.ts`: garante consolidação dos módulos, imutabilidade dos registros e comportamento sem dados.
- `tests/e2e/doc-monitor-live.spec.ts`: valida renderização, rotação e atualização imediata por `doctype:records-changed` em desktop/mobile.
- `tests/e2e/doc-monitor-live-attention.spec.ts`: valida que contador, drawer e card nativo compartilham a mesma contagem ao vivo e que uma nova exceção altera o número automaticamente.
- PR #13 adicionou validação específica de mudança de alerta sem alteração de registro, cobrindo o bug em que a passagem do tempo podia alterar `alerts` sem mudar `id/updatedAt`.

Sempre preservar também os testes anteriores de alertas, Guardião, contraste, DOC CRM, configurações e jornada completa.

## Correções estruturais já realizadas
- Builds quebrados após inclusão dos módulos comerciais.
- Tipagem global de módulos incompatível.
- Estado duplicado/dessincronizado entre Clientes 360° e gestão comercial.
- Menu móvel não fechando em módulos comerciais.
- Topbar e menu comercial dessincronizados.
- Mais de um item ativo no menu.
- Visual comercial fora do padrão DOCTYPE.
- Asset inválido do Guardião.
- Textos ocultos por contraste em tabelas, Renovações, DOC CRM, DOC Monitor e hovers.
- Alinhamento do botão Salvar meta em Configurações.
- Segurança global de contraste nos estados hover/focus.
- Contagem fixa/dessincronizada no balão do DOC Monitor.
- Dupla contagem potencial de alertas + tarefas + renovações no selo do Guardião.
- Ciclo de polling que podia abortar a própria requisição ao trocar de `live` para `syncing`.
- Divergência entre o estado ao vivo do balão e o `state.alerts` das superfícies nativas.
- PR #13: unificação efetiva do estado ao vivo com `MonitorStateBridge`, incluindo alertas que mudam somente pela passagem do tempo.

## Testes exigidos antes de qualquer merge em main
Nunca considerar uma alteração pronta apenas porque compilou. Antes de publicar, exigir:
1. `lint`
2. `typecheck`
3. testes unitários
4. `build`
5. E2E Chromium desktop
6. E2E mobile
7. preview Vercel `success`
8. após merge, deployment de produção Vercel `success`

## Jornadas críticas que não podem regredir
- Produto → Cliente com produto → Orçamento → Contrato → reload → persistência.
- CRUD e persistência dos módulos nativos.
- Topbar mostra o módulo atual.
- Apenas um item ativo no menu.
- Menu mobile não bloqueia a página.
- DOC Monitor carrega o Guardião válido.
- DOC Monitor recebe evento de mudança, refaz `/api/state` e volta ao estado `AO VIVO`.
- Contador do Guardião, drawer, menu e card de pontos de atenção permanecem sincronizados.
- Alerta derivado apenas da passagem do tempo também atualiza menu/card/selo/balão sem exigir edição do registro.
- Mudança externa detectada pelo polling reconcilia o restante da UI sem gerar loop.
- Falha de sincronização do monitor não pode derrubar ou limpar os outros módulos.

## Estado confirmado ao encerrar em 23/08/2026
- PR #13: `Fix single live attention state across DOC.OS` — mergeada.
- Merge commit funcional: `f1d4a781c9bee9381223263104621606f8585292`.
- CI antes do merge: `quality` success, E2E Chromium success, E2E mobile success.
- Vercel após o merge: `success`.
- Último problema resolvido: o balão estava atualizado pelo `doctype:monitor-state`, mas as superfícies nativas podiam permanecer com alertas antigos. A ponte de estado único elimina essa divergência.

## Forma de trabalho obrigatória
- Mudanças estruturais em branch própria.
- Abrir PR.
- Rodar toda a bateria de CI/E2E.
- Fazer merge apenas verde.
- Confirmar Vercel após o merge.
- Não afirmar produção pronta enquanto o deployment estiver `pending` ou `error`.
- Atualizar este `PROJECT_HANDOFF.md` sempre que houver alteração relevante de arquitetura, integração ou fluxo.

## Arquivos importantes
- `src/components/doctype-os.tsx` — shell/navegação e módulos nativos.
- `src/components/commercial-suite.tsx` — Produtos/Orçamentos/Contratos.
- `src/app/commercial-suite.css` — visual comercial.
- `src/lib/types.ts` — tipos e registros.
- `src/lib/state.ts` — estado autorizado/persistência.
- `src/lib/monitor.ts` — alertas do Guardião.
- `src/lib/monitor-engine.ts` — consolidação de observabilidade.
- `src/components/realtime-monitor.tsx` — monitor ao vivo resiliente e barramento de estado.
- `src/components/monitor-state-bridge.tsx` — reconcilia o pacote ao vivo com o estado do DOC.OS.
- `src/app/realtime-monitor.css` — UI do monitor ao vivo.
- `src/components/doc-monitor-overlay.tsx` — overlay/balão do Guardião sincronizado.
- `src/app/doc-monitor-live.css` — camada responsiva do balão ao vivo.
- `src/app/api/records/*` — CRUD.
- `tests/e2e/commercial.spec.ts` — jornada comercial.
- `tests/e2e/journeys.spec.ts` — jornadas gerais.
- `tests/e2e/doc-monitor-live.spec.ts` — sincronização/rotação do monitor.
- `tests/e2e/doc-monitor-live-attention.spec.ts` — contagem dinâmica, balão e estado único.

## Módulo financeiro — cobrança de clientes, Caixa Principal e impostos (15/09/2026)
- **Cobrança por fatura (boleto/cartão)**: nova rota `POST /api/finance/invoices/[id]/payment-link` cria uma Stripe Checkout Session (`mode:"payment"`, card+boleto) usando a **mesma conta Stripe global** já configurada para a assinatura SaaS (`STRIPE_SECRET_KEY`). Decisão explícita do usuário: o dinheiro cai na conta Stripe da DOCTYPE, não em uma conta por tenant — não há Stripe Connect nem chave por organização. Botão "Gerar cobrança" (ícone `Link2`) aparece na tabela de faturas do Financeiro para quem pode escrever em `invoices` (CEO_ADMIN/FINANCE), some quando a fatura já está Paga/Cancelada. Sem `STRIPE_SECRET_KEY` configurada, a rota responde 503 com mensagem amigável (comportamento confirmado via QA).
- O webhook (`/api/webhooks/stripe/route.ts`) ganhou um branch para `checkout.session.*` com `metadata.kind === "client_invoice"`: em vez de atualizar `saas_billing` (fluxo antigo da assinatura), atualiza o registro da fatura em `records` (status → Pago, `paidAt`, `paymentLinkStatus`). Usa um `stream` de cursor próprio (`checkout-invoice`, novo valor em `StripeEventCursorsTable.stream`) para não competir com o cursor de ordenação da assinatura SaaS.
- Campos novos em `moduleSchemas.invoices` (`src/lib/modules.ts`): `paymentLink`, `paymentLinkStatus`, `stripeCheckoutSessionId` — preenchidos só pelo servidor (rota de cobrança + webhook), nunca digitados no formulário. Coluna "Cobrança" nova em `configs.invoices.columns`.
- **Taxa de impostos**: novo setting `taxRate` (%) em Configurações, salvo via `/api/settings` (agora aceita atualização parcial de `crmGoal`/`taxRate` independentemente).
- **Caixa Principal**: nova sub-aba dentro de Financeiro (`FinanceView` → `view-tabs` "Visão geral" / "Caixa Principal"). `CashFlowPanel` + `buildCashFlowRows` agregam faturas/despesas por mês (vencimento no modo Projetado, `paidAt` no modo Realizado), deduzindo a `taxRate` das entradas antes de calcular saldo do mês e saldo acumulado. Testado manualmente: R$1.000 bruto com 20% de imposto → R$800 líquido, cálculo confirmado na tabela.
- **DOC Monitor ao vivo**: `buildAlerts` (`src/lib/monitor.ts`) ganhou parâmetro `taxRatePercent` e dois alertas novos — "Pagamento recebido" (fatura paga no dia) e "Fluxo de caixa negativo no mês" (crítico, líquido de impostos, ignora lançamentos Cancelados). `state.ts` passa `settings.taxRate` para `buildAlerts`. Como todo o Monitor ao vivo (sidebar, balão flutuante do Guardião, Dashboard) já consome `state.alerts` via polling de 3s em `/api/state`, os novos alertas aparecem automaticamente em todas as superfícies sem trabalho adicional — não foi necessário tocar em `monitor-engine.ts`/`buildMonitorSnapshot` (painel "Pulso do DOC.OS" separado, com métricas próprias). Cobertura em `tests/monitor.test.ts`.
- **Pendente/decisão explícita do usuário a rever no futuro**: como o pagamento cai na conta Stripe da DOCTYPE e não na de cada tenant, qualquer repasse financeiro para a empresa dona da fatura é manual/fora do sistema. Se o modelo de negócio exigir isolamento financeiro real por organização, revisar para Stripe Connect (opção descartada nesta rodada por decisão do usuário).

## Regra de continuidade
Se outra pessoa, IA ou desenvolvedor assumir o projeto, deve começar por este arquivo, pelo `CODEX_PROMPT.md` e pelo histórico do GitHub. Preservar identidade DOCTYPE, persistência multiusuário, permissões, DOC Monitor, testes e jornadas já validadas. Nunca substituir a arquitetura existente por uma implementação paralela sem justificar, migrar e testar integralmente.
