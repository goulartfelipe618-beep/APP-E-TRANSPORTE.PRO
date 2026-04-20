# Manual de segurança — referência rápida

Este projeto combina **React (Vite)**, **Supabase** (Auth + Postgres + Storage), **Edge Functions** e uma **API Node opcional** (`server/`). Use este ficheiro como checklist ao alterar autenticação, uploads, multi-tenant ou integrações externas.

**Pré-deploy:** `npm run security-check` — `npm audit` (falha só em high/critical) + verificação de ficheiros `.env*` fora do padrão e de `.env` versionado no Git.

---

## Modelo multi-tenant e isolamento de dados

- **Fonte de verdade** para “quem vê o quê” é o **Row Level Security (RLS)** no Postgres, não o menu do React nem flags só no browser.
- A maioria das tabelas de negócio inclui **`user_id`** (dono do tenant). As políticas devem garantir `auth.uid() = user_id` para leituras/escritas do painel motorista/táxi, exceto onde **`is_platform_staff()`** ou **`is_admin_master()`** permite operações administrativas explícitas.
- **Nunca** confie em `user_id` vindo só do corpo JSON do cliente sem validar contra `auth.uid()` nas políticas ou em RPCs `SECURITY DEFINER` bem revistas.
- **Injeção SQL:** o cliente usa o SDK PostgREST (`supabase.from().select/insert/...`) com parâmetros; RPCs em SQL devem usar **funções com argumentos tipados** e evitar concatenar strings SQL com input do utilizador.
- Após criar ou alterar tabelas: correr **`supabase/scripts/audit_rls_gaps.sql`** no SQL Editor e corrigir lacunas antes de produção.

---

## APIs externas, Edge Functions e SSRF

- **`evolution-proxy`:** o browser não chama a Evolution diretamente; a função faz `fetch` no servidor. O input (`baseUrl`) é validado com **`_shared/ssrfSafeHttps.ts`**: só **HTTPS**, bloqueio de **RFC1918**, **link-local (169.254/...)**, **loopback**, **ULA IPv6**, **`.internal` / metadata**, etc. A resposta do upstream é **truncada** (~400k chars) para evitar exaustão de memória na Edge.
- **`comunicar-webhook-dispatch`:** URLs lidas da base passam pela mesma validação antes de `fetch` ao n8n.
- **`n8n-comunicar-proxy`:** o destino é restrito ao **hostname fixo** `n8n.e-transporte.pro` e path `/webhook/...` (defesa em profundidade contra webhook arbitrário).
- **`check-domain`:** só consulta **RDAP/DNS** de registos conhecidos; o domínio é normalizado antes de compor URLs (sem concatenar input cru em SQL).
- **CORS nas Edge:** `Access-Control-Allow-Origin: *` é comum em funções invocadas com `apikey` + JWT; o controlo de acesso real é **`getUser()`** + RLS. Não exponha segredos no corpo de resposta.
- **Rotação:** se uma chave de Evolution ou webhook vazar, rode credenciais no fornecedor e atualize segredos no Supabase (Secrets), não só no `.env` local.

---

## Middlewares ativos (API Node — `server/`)

| Peça | Função |
|------|--------|
| **Helmet** (`server/app.mjs`) | Define cabeçalhos HTTP seguros por defeito (CSP está desativado na API porque não serve HTML; o CSP do site está no `vercel.json` em modo *report-only*). |
| **express-rate-limit** | Limite global de pedidos por IP e janela de tempo; rota modelo `POST /auth/login-attempt` usa limite mais apertado para brute-force. |
| **authSupabaseMiddleware** (`server/middleware/authSupabase.mjs`) | Valida o JWT do Supabase (`Authorization: Bearer`) com `auth.getUser` e anexa `req.supabaseUser` às rotas protegidas. |
| **originAllowlistMiddleware** | Em produção, para métodos mutadores com cabeçalho `Origin`, exige correspondência com `ALLOWED_ORIGINS` (mitigação CSRF para APIs que possam vir a usar cookies). |
| **CORS (`cors`)** | Em **produção**, se `ALLOWED_ORIGINS` estiver vazio, **`origin: false`** — nenhuma origem cross-browser é aceite até configurar explicitamente. Em desenvolvimento mantém-se permissivo. |

Arranque: `npm run server` (variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY`, **`ALLOWED_ORIGINS`** em produção).

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

### Tabela `painel_client_error_logs`

- **INSERT:** só `user_id = auth.uid()` (o browser não pode fingir outro tenant).
- **SELECT / DELETE:** só **`is_admin_master`** — logs podem conter dados sensíveis; trate como PII interno.
- O campo `extra.href` é gravado **sem query string nem hash** para evitar vazamento de tokens OAuth/PKCE nos relatórios.

---

## Armazenamento no browser (tokens vs preferências)

- **JWT / sessão Supabase:** geridos pelo cliente oficial em `sessionStorage` (ver `integrations/supabase/client.ts`). Não há `localStorage.setItem` manual para `access_token` / `refresh_token`.
- **`authExpiry`:** carimbo de início da janela de 24 h em `sessionStorage` (com leitura legacy em `localStorage` só para migração de abas antigas).
- **`getPersistedSupabaseUserId`:** procura chaves `sb-*` primeiro em `sessionStorage`, depois em `localStorage` (legacy).
- **Outros `localStorage.setItem`:** preferências de UI (tema do painel, destaques Network, mapas de avisos / fullscreen) — não são credenciais.
- **Nunca** prefixar segredos de servidor com `VITE_` — tudo com `VITE_` vai para o bundle público.

---

## Dashboard / RLS

- **`isRlsOrPermissionError`** (`src/lib/supabaseRlsErrors.ts`): identifica erros de permissão nas respostas PostgREST.
- **`AdminMetricas`**: contadores e agregações regionais degradam para `0` / listas vazias quando o RLS bloqueia leituras globais, com aviso em ecrã em vez de falha silenciosa.
- Outras páginas admin com listagens globais devem seguir o mesmo padrão (tratar `error` + `isRlsOrPermissionError`).

---

## Planos (`user_plans`)

- Valores persistidos: **`free`** e **`pro`** (legados `seed` / `grow` / `rise` / `apex` são normalizados no cliente e migrados no Postgres para `pro`; ver `supabase/migrations/20260430220000_user_plans_free_pro.sql`).
- **FREE → PRÓ** pelo utilizador: Edge Function `self-upgrade-plan` com JWT; só a partir de `free`; escrita em `user_plans` no servidor com **service role** (não confiar só no menu do browser).
- **Admin:** `admin-users` (`update_plan`, `finalize_landing_lead`) valida `free` | `pro`; FREE não é atribuído manualmente a utilizadores já em Cadastrados (regra de negócio).
- O menu do motorista executivo restringe páginas no cliente (`frotaPlanFreePages`); **não substitui RLS** — dados sensíveis seguem protegidos por políticas nas tabelas.

---

## Webhooks (Node + Edge)

- **Edge (`supabase/functions/_shared/webhook_hmac.ts`):** validação HMAC opcional com `WEBHOOK_INBOUND_HMAC_SECRET` e cabeçalho `x-webhook-signature` (corpo bruto UTF-8), usada por exemplo em `webhook-solicitacao`.
- **Node (`server/app.mjs`):** `POST /webhooks/inbound` — `express.raw` para o digest coincidir com n8n/Evolution; **`verifyWebhookHmacMiddleware`** (`server/middleware/verifyWebhookHmac.mjs`); rate limit dedicado **`RATE_LIMIT_WEBHOOK_MAX`** (predefinido **2000**/15 min), **sem** passar pelo limite global agressivo. Limite de login continua separado (`RATE_LIMIT_LOGIN_MAX`).

---

## Auditoria periódica (recomendado)

| Frequência | Ação |
|------------|------|
| Cada release | `npm run security-check` + `npm audit` |
| Após migrações | `audit_rls_gaps.sql` no projeto Supabase |
| Trimestral | Rever Secrets no Supabase, URLs de webhook, chaves Evolution/Mapbox com **URLs restritas** onde o fornecedor permitir |
| Incidente | Rodar credenciais, rever `painel_client_error_logs` (Admin → Logs), logs Vercel/Edge |

---

## Outros pontos

- **Sessão Supabase no cliente:** `src/integrations/supabase/client.ts` — `flowType: pkce`, storage em `sessionStorage` (por aba), `autoRefreshToken` quando há storage.
- **Auditoria RLS:** `supabase/scripts/audit_rls_gaps.sql`.
- **Migração de fecho de lacunas + leitura pública login:** `supabase/migrations/20260430210000_rls_gaps_closure_and_public_read.sql`.
