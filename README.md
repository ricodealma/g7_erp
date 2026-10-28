# Cantina G7 — ERP de Balcão

Web App (PWA) para pedidos de balcão, controle de estoque e impressão de comandas em impressora térmica Bluetooth. Requisitos completos em [`requisitos.md`](requisitos.md).

**Stack:** Next.js 16 (App Router) · Prisma 7 + PostgreSQL (Supabase) · Supabase Auth · Tailwind CSS 4 · Vercel.

## Desenvolvimento local

Pré-requisitos: Node.js 22+, pnpm, Docker.

```bash
pnpm install
cp .env.example .env      # ajuste os valores
pnpm db:up                # PostgreSQL local (porta 5433)
pnpm db:migrate           # aplica migrations
pnpm db:generate          # gera o Prisma Client (não é automático no Prisma 7)
pnpm db:seed              # dados iniciais (idempotente)
pnpm dev
```

## Testes

```bash
pnpm test        # unitários + integração (recria o banco g7_erp_test no PostgreSQL local)
pnpm test:unit   # apenas lógica pura (combos, Pix, cupom, ESC/POS)
```

O banco de integração vem de `TEST_DATABASE_URL` (padrão `localhost:5433/g7_erp_test`) e precisa terminar em `_test`.

## Banco de dados e migrations

| Variável       | Uso                                                        |
| -------------- | ---------------------------------------------------------- |
| `DATABASE_URL` | Runtime da aplicação — Supavisor modo transação (`:6543`)  |
| `DIRECT_URL`   | CLI do Prisma (migrate/seed) — Supavisor modo sessão (`:5432`) |

- Nova alteração de schema: edite `prisma/schema.prisma` e rode `pnpm db:migrate --name <descricao>`.
- SQL que o Prisma não expressa (RLS, `CHECK`, índices parciais): `pnpm db:migrate --create-only --name <descricao>`, edite o `migration.sql` e rode `pnpm db:migrate`.
- Toda tabela nova precisa de `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` na migration.
- **Nunca** rode `migrate dev` contra produção; produção recebe `prisma migrate deploy` pelo pipeline.

## CI/CD

- **`ci.yml`** (PR e push na `main`): lint, typecheck, validação/formatação do schema, migrations em PostgreSQL efêmero, checagem de schema sem migration e build.
- **`deploy.yml`** (após CI com sucesso): PR → deploy de preview; `main` → `prisma migrate deploy` + deploy de produção na Vercel.
- O deploy por Git da Vercel está desligado em `vercel.json`; o pipeline controla a ordem.
- O deploy só roda quando configurado. Secrets do repositório: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DIRECT_URL`.

### Configurar a Vercel

1. Crie o projeto na Vercel e vincule localmente: `pnpm dlx vercel link` (gera `.vercel/project.json` com `orgId` e `projectId`).
2. Cadastre na Vercel (Production e Preview): `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `CRON_SECRET`.
3. Crie um token em *Vercel → Account Settings → Tokens* e cadastre os secrets no GitHub.

## Keep-alive do Supabase

`vercel.json` agenda um cron diário para `GET /api/cron/keep-alive`, que executa `SELECT 1` e impede a pausa do projeto gratuito. A rota exige `Authorization: Bearer $CRON_SECRET`.
