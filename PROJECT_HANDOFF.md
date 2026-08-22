# DOC.OS — Handoff técnico e continuidade

Atualizado em: 22/08/2026

## Repositório e produção
- Repositório oficial: `doctype-startup/crm-gest-o-comercial-doctype`
- Branch de produção: `main`
- Último commit funcional validado antes deste handoff: `843814169e22b7460445b3d968f6cd42113d64f4`
- Vercel desse commit: `success`
- Projeto Vercel: `doctype-os-gestao`

## Objetivo do sistema
DOC.OS é o CRM/ERP interno da DOCTYPE Tecnologia e Marketing. Deve centralizar gestão comercial, clientes, financeiro, operação, DOC CRM, equipe, renovações, configurações e monitoramento inteligente pelo DOC Monitor.

## Identidade e UX obrigatórias
- Produto: `DOC.OS`
- Empresa/marca-mãe: DOCTYPE
- Visual: premium, tecnológico, escuro, azul-marinho + laranja DOCTYPE.
- Não redesenhar nem alterar a logo oficial DOCTYPE.
- Evitar páginas claras/brancas fora do padrão visual do sistema.
- Navegação deve usar o mesmo shell/topbar/sidebar em todos os módulos.
- Apenas um item do menu pode ficar ativo por vez.
- Desktop e mobile devem funcionar integralmente.

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

## Gestão comercial adicionada
### Produtos
Campos atuais incluem:
- Nome
- SKU/código
- Categoria
- Descrição
- Preço de venda
- Custo
- Unidade
- Tipo de cobrança
- Status
- Observações

### Clientes ↔ Produtos
O cadastro nativo de Clientes 360° possui `productIds`, permitindo associar produtos contratados ao cliente.

### Orçamentos
Inclui:
- Número
- Cliente
- Título
- Produtos
- Subtotal
- Desconto
- Total
- Validade
- Status
- Condições/observações

### Contratos
Inclui:
- Número
- Cliente
- Orçamento relacionado
- Título
- Produtos
- Valor
- Início
- Fim/renovação
- Data da assinatura
- Status
- Upload de contrato assinado em PDF ou imagem
- Observações

## Persistência e arquitetura
- Os registros usam a arquitetura compartilhada de `records` já existente no sistema.
- A segregação multiempresa é baseada em `org_id`.
- Produtos, Orçamentos e Contratos não devem criar um banco paralelo.
- A API e validações devem manter tipagem/validação dos módulos comerciais.
- Exclusão de cliente deve tratar registros comerciais relacionados conforme a regra vigente do backend.

## DOC Monitor / Guardião
- O Guardião é o mascote/monitor do DOC.OS.
- O asset válido em produção é `public/assets/guardiao-monitor.webp`.
- NÃO usar `public/assets/guardiao-inline.png`: esse arquivo foi identificado como inválido/corrompido (11 bytes).
- O DOC Monitor deve continuar exibindo alertas e direcionando para módulos relevantes.
- Não reintroduzir círculo laranja decorativo que atrapalhe o conteúdo do card.
- O Guardião deve aparecer integrado ao monitor e manter proporção correta.

## Correções estruturais recentes
Foram corrigidos:
- Builds quebrados após inclusão dos módulos comerciais.
- Tipagem global de módulos incompatível.
- Estado duplicado/dessincronizado entre Clientes 360° e gestão comercial.
- Menu móvel não fechando ao abrir Produtos/Orçamentos/Contratos.
- Módulos comerciais renderizados como camada paralela sem sincronizar o topo.
- Topbar mantendo título anterior (ex.: Financeiro ao abrir Produtos).
- Mais de um item ativo no menu.
- Visual branco dos módulos comerciais fora do padrão DOCTYPE.
- Problemas de acessibilidade no login usados pelos testes E2E.
- Instabilidade da suíte E2E com banco/servidor compartilhado.
- Asset inválido do Guardião.

## Testes exigidos antes de qualquer merge em main
Nunca considerar uma alteração pronta apenas porque compilou localmente. Antes de publicar, exigir:
1. `lint`
2. `typecheck`
3. testes unitários
4. `build`
5. E2E Chromium desktop
6. E2E mobile
7. preview Vercel `success`
8. após merge, deploy de produção Vercel `success`

## Jornada comercial crítica que deve continuar coberta
Produto → Cliente com produto → Orçamento → Contrato → recarregar página → confirmar persistência.

Também validar:
- Topbar mostra o nome do módulo atual.
- Apenas um item ativo no menu.
- Menu mobile não bloqueia a página.
- DOC Monitor carrega o Guardião válido.

## Forma de trabalho para futuras alterações
- Não editar a `main` diretamente em mudanças estruturais grandes.
- Criar branch de correção/feature.
- Abrir PR.
- Rodar toda a bateria de CI/E2E.
- Só fazer merge quando tudo estiver verde.
- Conferir Vercel após o merge.
- Não afirmar que algo está pronto enquanto o deploy estiver `pending` ou `error`.

## Arquivos importantes
- `src/components/doctype-os.tsx` — shell/navegação e módulos nativos.
- `src/components/commercial-suite.tsx` — gestão comercial e modais de Produtos/Orçamentos/Contratos.
- `src/app/commercial-suite.css` — visual comercial DOCTYPE.
- `src/components/doc-monitor-overlay.tsx` — overlay do DOC Monitor.
- `src/app/doc-monitor.css` — estilos do DOC Monitor.
- `src/app/guardiao-inline.css` — integração visual do Guardião no card.
- `src/lib/types.ts` — tipos de módulos e registros.
- `src/lib/state.ts` — estado/persistência.
- `src/app/api/records/*` — CRUD dos registros.
- `tests/e2e/commercial.spec.ts` — jornada comercial.
- `tests/e2e/journeys.spec.ts` — jornadas gerais do sistema.

## Regra de continuidade
Se outra pessoa, IA ou desenvolvedor assumir este projeto, deve começar por este arquivo e pelo histórico do GitHub. O código versionado no repositório é a fonte de verdade. Preservar identidade DOCTYPE, persistência multiusuário, permissões, DOC Monitor e as jornadas já testadas.
