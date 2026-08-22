# DOC.OS — Handoff técnico e continuidade

Atualizado em: 22/08/2026

## Repositório e produção
- Repositório oficial: `doctype-startup/crm-gest-o-comercial-doctype`
- Branch de produção: `main`
- Projeto Vercel: `doctype-os-gestao`
- O código versionado no GitHub é a fonte de verdade do sistema.
- Antes de trabalhar, conferir o HEAD atual de `main`, o último CI verde e o deployment Vercel correspondente.

## Objetivo do sistema
DOC.OS é o CRM/ERP interno da DOCTYPE Tecnologia e Marketing. Centraliza gestão comercial, clientes, financeiro, operação, DOC CRM, equipe, renovações, configurações e monitoramento inteligente pelo DOC Monitor.

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
- `src/app/realtime-monitor.css`: layout e estados visuais do monitor ao vivo.
- `src/components/doc-monitor-overlay.tsx`: balão flutuante/drawer do Guardião, alimentado pelo mesmo estado ao vivo.
- `src/app/doc-monitor-live.css`: responsividade e estados visuais do balão rotativo.

### Princípios obrigatórios
1. O monitor somente lê os registros autorizados retornados por `/api/state`.
2. O monitor não pode alterar registros, banco ou estado operacional dos outros módulos.
3. Eventos `doctype:records-changed` disparam uma atualização imediata do monitor.
4. Existe polling redundante a cada 10 segundos para reconciliação, multiusuário e recuperação de eventos perdidos.
5. Requisições simultâneas são serializadas; se chegar novo evento durante uma leitura, uma nova leitura é enfileirada.
6. Eventos são debounced para evitar tempestade de chamadas.
7. Uma falha de rede não zera o painel: mantém a última leitura válida e sinaliza `RECONECTANDO`.
8. Após 30 segundos sem leitura válida, o painel pode sinalizar `DADOS DESATUALIZADOS`.
9. Ao voltar para uma aba visível, o monitor sincroniza novamente.
10. Toda leitura válida publica `doctype:monitor-state`; painel, contador de atenção e balão consomem o mesmo pacote.
11. O estado de conexão é publicado em `doctype:monitor-sync` (`live`, `syncing`, `retrying`, `stale`).
12. Quando o polling identifica mudança real nos registros, publica `doctype:records-changed` com `detail.source = "monitor"` para reconciliar os componentes nativos. O próprio monitor ignora eventos com essa origem para impedir loop infinito.
13. O contador do balão NÃO soma tarefas/renovações por fora. Ele usa `alerts.length`, a mesma fonte exibida no card nativo de pontos de atenção, evitando dupla contagem.

### Pontos de atenção em tempo real
- O número exibido no selo do Guardião é dinâmico; não existe valor fixo como `3`.
- Se não houver alertas ativos, o selo não é exibido.
- Ao criar, editar ou resolver uma situação que gere/remova alerta, a contagem deve refletir a nova leitura automaticamente.
- O texto `X pontos pedindo atenção` dentro do drawer deve sempre coincidir com o selo.
- O card nativo `X pontos pedem atenção` é reconciliado pelo mesmo ciclo de estado via `doctype:records-changed`.

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
- Contador do Guardião, drawer e card de pontos de atenção permanecem sincronizados.
- Mudança externa detectada pelo polling reconcilia o restante da UI sem gerar loop de atualização.
- Falha de sincronização do monitor não pode derrubar ou limpar os outros módulos.

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
- `src/app/realtime-monitor.css` — UI do monitor ao vivo.
- `src/components/doc-monitor-overlay.tsx` — overlay/balão do Guardião sincronizado.
- `src/app/doc-monitor-live.css` — camada responsiva do balão ao vivo.
- `src/app/api/records/*` — CRUD.
- `tests/e2e/commercial.spec.ts` — jornada comercial.
- `tests/e2e/journeys.spec.ts` — jornadas gerais.
- `tests/e2e/doc-monitor-live.spec.ts` — sincronização/rotação do monitor.
- `tests/e2e/doc-monitor-live-attention.spec.ts` — contagem dinâmica e balão.

## Regra de continuidade
Se outra pessoa, IA ou desenvolvedor assumir o projeto, deve começar por este arquivo, pelo `CODEX_PROMPT.md` e pelo histórico do GitHub. Preservar identidade DOCTYPE, persistência multiusuário, permissões, DOC Monitor, testes e jornadas já validadas. Nunca substituir a arquitetura existente por uma implementação paralela sem justificar, migrar e testar integralmente.
