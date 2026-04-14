# Manual de segurança — referência rápida

Este projeto combina **React (Vite)**, **Supabase** (Auth + Postgres + Storage), **Edge Functions** e uma **API Node opcional** (`server/`). Use este ficheiro como checklist ao alterar autenticação, uploads ou base de dados.

**Pré-deploy:** `npm run security-check` — `npm audit` (falha só em high/critical) + verificação de ficheiros `.env*` fora do padrão e de `.env` versionado no Git.

---

## Middlewares ativos (API Node — `server/`)

| Peça | Função |
|------|--------|
| **Helmet** (`server/app.mjs`) | Define cabeçalhos HTTP seguros por defeito (CSP está desativado na API porque não serve HTML; o CSP do site está no `vercel.json` em modo *report-only*). |
| **express-rate-limit** | Limite global de pedidos por IP e janela de tempo; rota modelo `POST /auth/login-attempt` usa limite mais apertado para brute-force. |
| **authSupabaseMiddleware** (`server/middleware/authSupabase.mjs`) | Valida o JWT do Supabase (`Authorization: Bearer`) com `auth.getUser` e anexa `req.supabaseUser` às rotas protegidas. |
| **originAllowlistMiddleware** | Em produção, para métodos mutadores com cabeçalho `Origin`, exige correspondência com `ALLOWED_ORIGINS` (mitigação CSRF para APIs que possam vir a usar cookies). |

Arranque: `npm run server` (variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY`, opcionalmente `ALLOWED_ORIGINS`).

**Validação Zod (corpo JSON):** todas as rotas `POST` da API usam esquema Zod (`EmptyJsonBodySchema` ou `EchoBodySchema` em `server/app.mjs`). `GET /health` não tem corpo — não requer Zod.

---

## Fluxo de upload e Storage

1. O utilizador escolhe um ficheiro no browser.
2. **`assertUploadMagicBytes`** (`src/lib/validateUploadMagicBytes.ts`) lê os primeiros bytes (via `file-type`) e confirma o MIME real (ex.: PNG, JPEG), **não** apenas a extensão ou `file.type`.
3. Só depois disso o código chama `supabase.storage.from(...).upload(...)`.
4. O nome/extensão no *path* deve refletir o tipo detetado (`extensionForDetectedMime`) para consistência com o conteúdo.

Isto reduz uploads maliciosos disfarçados de imagem e alinha-se às boas práticas de Storage (políticas RLS do *bucket* continuam obrigatórias no Supabase).

---

## Novas tabelas Postgres — como configurar RLS (padrão)

1. **Criar a tabela** com `user_id uuid REFERENCES auth.users (id)` quando a linha pertencer a um utilizador.
2. **`ALTER TABLE public.minha_tabela ENABLE ROW LEVEL SECURITY;`**
3. **Políticas mínimas sugeridas:**
   - **SELECT** para `authenticated`: `public.is_platform_staff() OR (user_id IS NOT NULL AND auth.uid() = user_id)`.
   - **INSERT/UPDATE/DELETE**: regras explícitas (ex.: só o dono, ou só staff) — sem isto, o RLS pode bloquear escritas.
4. Se precisar de **leitura anónima** (ex.: conteúdo público na página de login), crie política `FOR SELECT TO anon USING (...)` explícita e `GRANT SELECT ... TO anon`.
5. Correr localmente o script **`supabase/scripts/audit_rls_gaps.sql`** após o deploy da migração para confirmar que não ficaram tabelas sem políticas.
6. Regenerar tipos TypeScript se usar `supabase gen types`.

---

## Armazenamento no browser (tokens vs preferências)

- **JWT / sessão Supabase:** geridos pelo cliente oficial em `sessionStorage` (ver `integrations/supabase/client.ts`). Não há `localStorage.setItem` manual para `access_token` / `refresh_token`.
- **`authExpiry`:** carimbo de início da janela de 24 h em `sessionStorage` (com leitura legacy em `localStorage` só para migração de abas antigas).
- **`getPersistedSupabaseUserId`:** procura chaves `sb-*` primeiro em `sessionStorage`, depois em `localStorage` (legacy).
- **Outros `localStorage.setItem`:** preferências de UI (tema do painel, destaques Network, mapas de avisos / fullscreen) — não são credenciais.

## Dashboard / RLS

- **`isRlsOrPermissionError`** (`src/lib/supabaseRlsErrors.ts`): identifica erros de permissão nas respostas PostgREST.
- **`AdminMetricas`**: contadores e agregações regionais degradam para `0` / listas vazias quando o RLS bloqueia leituras globais, com aviso em ecrã em vez de falha silenciosa.
- Outras páginas admin com listagens globais devem seguir o mesmo padrão (tratar `error` + `isRlsOrPermissionError`).

## Webhooks (Node + Edge)

- **Edge (`supabase/functions/_shared/webhook_hmac.ts`):** validação HMAC opcional com `WEBHOOK_INBOUND_HMAC_SECRET` e cabeçalho `x-webhook-signature` (corpo bruto UTF-8), usada por exemplo em `webhook-solicitacao`.
- **Node (`server/app.mjs`):** `POST /webhooks/inbound` — `express.raw` para o digest coincidir com n8n/Evolution; **`verifyWebhookHmacMiddleware`** (`server/middleware/verifyWebhookHmac.mjs`); rate limit dedicado **`RATE_LIMIT_WEBHOOK_MAX`** (predefinido **2000**/15 min), **sem** passar pelo limite global agressivo. Limite de login continua separado (`RATE_LIMIT_LOGIN_MAX`).

## Outros pontos

- **Sessão Supabase no cliente:** `src/integrations/supabase/client.ts` — `flowType: pkce`, storage em `sessionStorage` (por aba), `autoRefreshToken` quando há storage.
- **Auditoria RLS:** `supabase/scripts/audit_rls_gaps.sql`.
- **Migração de fecho de lacunas + leitura pública login:** `supabase/migrations/20260430210000_rls_gaps_closure_and_public_read.sql`.
