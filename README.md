# Cheerful Bond Builder — E-Transporte.pro

Painel web **React + Vite + TypeScript** com **Supabase** (Auth, Postgres, Storage, Edge Functions), áreas **Dashboard**, **Taxi** e **Admin**, integrações (mapas, PDF, QR Code, Evolution/WhatsApp, webhooks).

## Requisitos

- Node.js 20+ (recomendado)
- npm
- Projeto Supabase (URL + chave anon/publishable)

## Arranque local

```sh
git clone <URL_DO_REPOSITORIO>
cd cheerful-bond-builder
npm install
cp .env.example .env
# Edite .env com VITE_SUPABASE_* (ver .env.example)
npm run dev
```

A aplicação abre em `http://localhost:8080` (porta definida no Vite).

## Variáveis de ambiente

Ver **`.env.example`** na raiz. Resumo:

| Variável | Onde |
|----------|------|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | Browser / build |
| `VITE_MAPBOX_ACCESS_TOKEN` | Geocoding (opcional) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ALLOWED_ORIGINS`, `PORT`… | API Node (`npm run server`) |

Nunca commite `.env`. Segredos de webhooks e service role ficam no **Supabase Dashboard** / servidor, não no frontend.

## Scripts npm

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento Vite |
| `npm run build` | Build de produção |
| `npm run preview` | Pré-visualizar o build |
| `npm run lint` | ESLint (`--quiet` para só erros) |
| `npm run test` | Vitest (unitários) |
| `npm run server` | API Node opcional (`server/`) |
| `npm run security-check` | `npm audit` (high/critical) + checagens de ficheiros sensíveis |

## Estrutura do repositório

- **`src/pages/`** — páginas por rota (login, dashboard, admin, etc.)
- **`src/components/`** — UI reutilizável e layouts
- **`src/lib/`**, **`src/hooks/`** — utilitários e hooks
- **`src/integrations/supabase/`** — cliente Supabase e tipos gerados
- **`supabase/migrations/`** — SQL de esquema e RLS
- **`supabase/functions/`** — Edge Functions (Deno)
- **`server/`** — Express opcional (Helmet, rate limit, Zod, webhooks)
- **`README_SECURITY.md`** — checklist de segurança (RLS, uploads, API)

## Deploy

- **Frontend:** Vercel (ou outro host estático) com as mesmas variáveis `VITE_*` usadas no build.
- **Supabase:** aplicar migrações (`supabase db push` ou pipeline CI) e configurar secrets das functions.
- **API Node:** só se usar `server/` em produção (variáveis `SUPABASE_*`, `ALLOWED_ORIGINS`).

## Qualidade e otimização

- **TypeScript:** `npx tsc --noEmit` (projeto usa `strict: false` no app; endurecer é trabalho incremental).
- **ESLint:** `any` explícito está como **aviso** para não bloquear o legado; objetivo é substituir por tipos (`@/integrations/supabase/types`).
- **Bundle:** `React.lazy` + `Suspense` nas rotas pesadas; `manualChunks` no Vite para `recharts`, `jspdf`/`html2canvas`, mapas e ícones.
- **Erros React:** `AppErrorBoundary` em `src/main.tsx`.

## Documentação extra

- **`README_SECURITY.md`** — alinhado a boas práticas do projeto (CSP, webhooks HMAC, uploads, RLS).

## ADR (resumo)

1. **Auth:** Supabase JWT no cliente; rotas protegidas com componentes `Protected*Route`.
2. **Dados:** RLS obrigatório em tabelas expostas ao PostgREST; funções `is_platform_staff` / admin conforme migrações.
3. **API Node:** camada opcional para validação forte e limites de taxa, sem substituir RLS.
