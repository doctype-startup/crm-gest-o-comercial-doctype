# Codex handoff — DOCTYPE OS interno

Trabalhe neste projeto como uma aplicação interna da DOCTYPE. A usuária não programa: faça alterações completas, rode validações e explique somente o necessário.

## Objetivo do produto
Sistema interno de gestão da DOCTYPE. Não incluir CRM comercial, funil de leads, propostas ou follow-up comercial.

## Módulos obrigatórios
1. Dashboard executivo: MRR, clientes ativos, a receber, inadimplência, renovações, tarefas críticas e alertas DOC.
2. Clientes 360°: dados cadastrais, serviços, mensalidade, vencimento, início, renovação, aviso prévio, responsável, saúde, status e observações.
3. Acessos: plataformas/redes sociais dos clientes, login/e-mail, usuário/ID, URL, 2FA, responsável, status, referência segura de segredo e observações. Nunca armazenar senha em texto aberto.
4. Financeiro: receitas/faturas, despesas, MRR, pendências e visão gerencial.
5. Operação: tarefas, prazos, prioridade, responsável e status.
6. Renovações: D-30, D-15, D-7 e D0, com alertas.
7. DOC CRM: Start/Smart/Pro/Legado, MRR, setup, custo de plataforma/canais, margem e meta de MRR.
8. Equipe: integrantes, papéis, responsabilidades e custo operacional.
9. DOC Monitor: o mascote é o Guardião operacional. Deve observar, orientar e alertar sobre exceções; não é decoração.
10. Configurações e backup.

## Identidade visual
- Laranja DOCTYPE: #FF6400
- Azul institucional: #06133F
- Grafite: #101419
- Branco gelo: #F7F8FA
- Cinza: #8A93A2
- Títulos: Montserrat (fallback seguro se não houver fonte local)
- Interface: Inter (fallback system-ui)
- Usar somente os ativos fornecidos em assets/.

## Estado atual
A aplicação MVP é estática e usa persistência localStorage. Há self-test planejado em `?selftest=1` e o JavaScript deve passar em `node --check app.js`.

## Próxima evolução para produção multiusuário
Migrar para aplicação web com autenticação e banco compartilhado. Preferir stack simples e sustentável (ex.: Next.js + Supabase/Postgres ou equivalente), mantendo UX e regras do MVP. Implementar RBAC para CEO/Admin, Operação e Financeiro; audit log; criptografia/segredo externo para credenciais; exportação; backups; LGPD; validação de formulários; estados de loading/erro; testes automatizados.

## Critério de pronto
Não declarar pronto apenas porque compilou. Executar lint/typecheck/build/testes e testar todas as jornadas CRUD principais. Documentar qualquer limitação real. Não publicar uma versão que quebre recursos já funcionais. Todos os botões e formulários visíveis precisam ter comportamento funcional ou ser removidos até estarem implementados.
