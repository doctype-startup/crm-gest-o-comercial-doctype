# DOCTYPE OS — Gestão Interna

Sistema interno da DOCTYPE para gestão operacional da agência.

## Escopo
- Dashboard executivo
- Clientes 360°
- Acessos de redes e plataformas dos clientes
- Financeiro
- Operação e tarefas
- Renovações
- DOC CRM
- Equipe
- DOC Monitor
- Configurações e backup

## Fora do escopo
Este projeto **não** deve conter CRM comercial, funil de leads, propostas ou follow-up comercial.

## Identidade DOCTYPE
- Laranja: `#FF6400`
- Azul institucional: `#06133F`
- Grafite: `#101419`
- Branco gelo: `#F7F8FA`
- Cinza de apoio: `#8A93A2`

## Segurança
Não armazenar senhas de clientes em texto aberto. O módulo de acessos deve guardar login/e-mail, usuário/ID, URL, status, 2FA, responsável e uma referência segura para o segredo.

## Codex
Leia `CODEX_PROMPT.md` antes de alterar o projeto. O objetivo é chegar a uma versão de produção multiusuário, com autenticação, banco compartilhado, permissões, auditoria, backup e testes de todas as jornadas principais.
