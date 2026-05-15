# Relatório de auditoria de segurança (full stack)

**Data (geração):** 2026-05-14  
**Âmbito:** Repositório `cheerful-bond-builder` — Supabase (migrações SQL + config Edge), API Node (`server/`), frontend Vite/React (`src/`), integração Mercado Pago, scripts e política de dependências.  
**Metodologia:** análise estática (grep, leitura de ficheiros críticos), `npm audit --audit-level=high`, `npm run security-check`. **Não** foi feita penetração em produção nem varrimento dinâmico de todas as rotas UI.

**Limitações explícitas:** não é possível garantir “100% das tabelas” sem consultar o `information_schema` **na instância Postgres em execução** após todas as migrações. O repositório inclui a migração `20260430210000_rls_gaps_closure_and_public_read.sql`, que **ativa RLS** e cria políticas **SELECT** de emergência para lacunas; isso **não substitui** políticas completas INSERT/UPDATE/DELETE por tabela. **Não existe coluna `empresa_id`** no código analisado — o isolamento documentado é por **`user_id`** + `is_platform_staff()` / `is_admin_master()`.

**Actualização 2026-05-15:** migração `20260515160000_rls_gapfill_owner_iud.sql` — preenche lacunas **INSERT/UPDATE/DELETE** só para o dono (`user_id = auth.uid()`) em tabelas com `user_id uuid` que ainda não tinham política desse tipo, com exclusões explícitas (reservas, solicitações, rastreios, comunidade, rede, financeiro, papéis, logs, etc.); inclui função/trigger `tenant_row_force_user_id_ins()` que força `user_id := auth.uid()` em `BEFORE INSERT` quando há sessão JWT. **Aplicar com `supabase db push` e testar fluxos.**

---

## Resumo executivo

| Área | Estado geral | Risco residual |
|------|----------------|----------------|
| Supabase RLS | Forte base (migrações + fecho de lacunas SELECT); políticas de escrita variam por tabela | **Médio/Alto** sem correr `audit_rls_gaps.sql` em produção após cada release |
| Storage | Vários buckets com **leitura pública** intencional (marketing/site) | **Médio** — enumerar paths se nomes previsíveis |
| API Node | Helmet, rate limit, Zod, JWT Supabase, CORS restritivo em prod, webhooks HMAC/MP assinado | **Baixo** — configurar `ALLOWED_ORIGINS` e segredos MP em prod |
| Mercado Pago | Valores calculados no servidor (`PLAN_TOTALS`); `external_reference` amarra `userId`; webhook com assinatura + idempotência | **Baixo** se `MP_WEBHOOK_SECRET` obrigatório em prod (já enforced) |
| Frontend | Chave anon/public; sessão em `sessionStorage`; sem service role em `src/` | **Baixo** |
| Dependências | `npm audit` high/critical: **0** | rever moderate periodicamente |
| GitHub / Vercel | `.gitignore` cobre `.env`; `.env.example` sem segredos reais | **Manual:** secrets no painel Vercel, branch protection, logs CI |

---

## 1. Supabase (Postgres, RLS, RPC, triggers)

### 1.1 RLS e políticas

- **Fecho de lacunas:** `supabase/migrations/20260430210000_rls_gaps_closure_and_public_read.sql` percorre tabelas `public` sem RLS ou sem **qualquer** política; faz `ENABLE ROW LEVEL SECURITY` e cria `*_rls_gap_select_v2`:
  - Com coluna `user_id`: `is_platform_staff() OR auth.uid() = user_id`.
  - Sem `user_id`: apenas `is_platform_staff()` para `authenticated`.
- **Exceções anónimas controladas:** `login_painel_config` (SELECT `id = 1`), `admin_avisos_plataforma` (anon, avisos de login).
- **Grep `USING (true)` / `WITH CHECK (true)`** nas migrações: **nenhuma ocorrência** encontrada.

**Classificação — MÉDIA (processo):** sem executar periodicamente `supabase/scripts/audit_rls_gaps.sql` no SQL Editor após novas tabelas, pode haver lacunas SELECT ou falta de políticas de escrita.

**Recomendação manual:** para cada tabela de negócio, políticas **explícitas** FOR SELECT / INSERT / UPDATE / DELETE conforme o papel (dono, staff, admin_master). O padrão está descrito em `README_SECURITY.md`.

### 1.2 Multi-tenant / `empresa_id`

- **Não aplicável ao modelo actual:** não há `empresa_id` no repositório; o desenho é **uma conta = um `user_id`** (painel motorista executivo). Qualquer futura coluna `empresa_id` **não** deve ser confiável só no corpo do cliente — exigir derivação em trigger/RPC/backend.

### 1.3 Storage (buckets)

Políticas encontradas (exemplos):

| Bucket | Leitura | Nota |
|--------|---------|------|
| `veiculos-imagens` | **public** SELECT | Conveniência para imagens de frota; risco se paths adivinháveis |
| `catalogo-motorista` | public read bucket | Escrita por pasta `auth.uid()` |
| `fullscreen-banners`, `login-assets`, `website-briefing`, `community-media` | public read | Conteúdo de marketing/comunidade |
| `motorista-frota-docs`, `cadastro-clientes-docs` | authenticated, path sob dono | Mais restritivo |

**Classificação — MÉDIA:** leitura pública é aceitável para assets públicos, mas aumenta superfície de **enumeração** se os paths forem previsíveis. Mitigação: paths aleatórios, signed URLs, ou bucket privado + proxy.

### 1.4 Realtime

- Migração `20260514180000_user_plans_realtime_publication.sql` (se aplicada) expõe mudanças de `user_plans` a clientes com RLS — utilizador só vê a própria linha.

### 1.5 Edge Functions (`verify_jwt` em `supabase/config.toml`)

Várias funções com **`verify_jwt = false`** (webhooks, portal motorista, proxy, etc.). Isto é **aceitável** quando o código **valida** API key, HMAC, JWT de aplicação ou segredo partilhado no corpo/cabeçalho.

**Classificação — MÉDIA:** cada função com `verify_jwt = false` deve manter checklist de validação; regressão num deploy é risco.

### 1.6 Service role

- **Não** encontrado em `src/`.
- Uso legítimo: `server/mercadoPagoPayments.mjs`, `server/app.mjs` (`POST /auth/login-attempt`), Edge functions server-side.

**Classificação — CRÍTICA** se vazar para o browser ou para logs não redigidos — actualmente mitigado no cliente e em `server/logMeta.mjs` (referência em README_SECURITY).

---

## 2. Backend Node.js (`server/`)

| Control | Ficheiro / notas |
|---------|------------------|
| Helmet + CSP API | `app.mjs` — `scriptSrc` inclui Mercado Pago SDK |
| `X-Powered-By` desligado | `app.disable("x-powered-by")` |
| Rate limit | Global, login, webhooks, MP webhook, criação de pagamento (IP + por utilizador), status |
| CORS | Produção: `false` se `ALLOWED_ORIGINS` vazio |
| Origem mutadora | `originAllowlistMiddleware` em produção |
| JWT | `authSupabaseMiddleware` com `getUser(token)` |
| Zod | `CreatePreferenceBodySchema.strict()`, echo, login-attempt |
| Payload JSON | `limit: "100kb"` |
| Erros | Resposta genérica em produção; log via Winston |

**Classificação — BAIXA** no código revisto. **ALTA** operacional se `ALLOWED_ORIGINS` / `MP_ACCESS_TOKEN` / `SUPABASE_*` em falta ou errados.

---

## 3. Mercado Pago

- **Montante:** `transaction_amount` / preapproval vêm de **`PLAN_TOTALS[plano][ciclo]`** no servidor — **não** do valor mostrado só no frontend (o front usa `getBillingCycleTotal` para UI, alinhado).
- **`plano` / `ciclo`:** validados com `z.enum`; regras de upgrade (ex.: STANDART → só PRÓ) no handler.
- **`external_reference`:** `mp:{userId}:{plano}:{ciclo}` — liga pagamento ao utilizador autenticado na criação.
- **Webhook:** `verifyMercadoPagoWebhookSignature` (HMAC, timestamp, `timingSafeEqual`); em produção **falha** se `MP_WEBHOOK_SECRET` ausente.
- **Idempotência:** `mp_webhook_events` + `insert` com deduplicação por `eventKey`.
- **Status GET:** `assertPaymentAccess` compara dono / `external_reference` — evita ler pagamento de outro utilizador.
- **Access token MP:** só `process.env.MP_ACCESS_TOKEN` no servidor.

**Classificação — BAIXA** no desenho actual para “pagamento falso” via cliente: o cliente não confirma plano sozinho sem resposta MP + política `billing_manual_override`.

---

## 4. Frontend React

- **Segredos:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` apenas; cliente Supabase em `sessionStorage` + PKCE + `processLock`.
- **Sem `empresa_id` injectável** no modelo actual.

**Classificação — BAIXA.**

---

## 5. GitHub / Vercel

- `.gitignore`: `.env`, `.env.*`, `!.env.example`, chaves PEM, etc.
- `security-check` valida `.env` não versionado.
- **Manual:** variáveis na Vercel (prod/preview), não expor `VERCEL_*` desnecessários em logs, branch protection, 2FA org GitHub.

---

## 6. Dependências

- `npm audit --audit-level=high`: **0** vulnerabilidades high/critical (na execução desta auditoria).

---

## 7. Alterações implementadas nesta auditoria

| Ficheiro | Alteração |
|-----------|-----------|
| `scripts/security-check.mjs` | Lista alargada de `git grep` em `src/` para padrões de segredo (MP tokens, webhook HMAC, chaves PEM literais). |
| `supabase/migrations/20260515160000_rls_gapfill_owner_iud.sql` | Políticas I/U/D só-dono onde faltavam; trigger `tenant_row_force_user_id_ins` (exclusões no ficheiro). |
| `SECURITY_AUDIT_REPORT.md` | Este relatório (riscos, classificações, acções manuais). |

Não existe migração RLS “universal” sem exclusões: a migração acima é **cirúrgica** (tabelas com `user_id uuid` e listas de exclusão) e **deve** ser validada com `audit_rls_gaps.sql` e testes de regressão na app.

---

## 8. Vulnerabilidades / riscos inventariados (por severidade)

### CRÍTICA (operacional / se mal configurado)

1. **`SUPABASE_SERVICE_ROLE_KEY` ou `MP_ACCESS_TOKEN` em variável de ambiente do frontend ou em repositório público** — destrói isolamento. *Mitigação actual:* não presente em `src/`; `.gitignore` + security-check.

### ALTA

1. **Nova tabela sem políticas de escrita** após migração — utilizador autenticado pode ficar bloqueado ou, em cenários errados, expor dados se políticas forem mal desenhadas. *Mitigação:* `audit_rls_gaps.sql` + revisão humana por feature.

### MÉDIA

1. **Buckets storage com SELECT público** — depende de path não adivinhável ou conteúdo não sensível.  
2. **Edge `verify_jwt = false`** — depende de validação manual contínua.  
3. **`GET /api/payments/status/:paymentId`** chama handlers de reconciliação — efeito lateral; mitigado com rate limit e `assertPaymentAccess`, mas convém monitorizar abuso.

### BAIXA

1. **Helmet CSP na API** aplica-se também a respostas JSON (efeito limitado em APIs puras).  
2. **Mensagens de erro** em desenvolvimento mais verbosas no handler global.

---

## 9. Checklist manual recomendado (próximos 30 dias)

1. Correr `supabase/scripts/audit_rls_gaps.sql` no projeto Supabase e corrigir **todas** as linhas reportadas.  
2. Rever **cada** função com `verify_jwt = false` no `config.toml` (checklist por função).  
3. Confirmar na Vercel: nenhum secret com prefixo `VITE_`; `VITE_API_BASE_URL` aponta para API com HTTPS.  
4. Confirmar `MP_WEBHOOK_SECRET` e `ALLOWED_ORIGINS` em produção na API Node.  
5. Plano de resposta a incidente: rotação de chaves, revisão de `admin_audit_log` / `auth_login_failure_events`.

---

## 10. Riscos que permanecem (honestidade)

- **Auditoria não exaustiva ficheiro a ficheiro** de todos os `supabase/functions/**/*.ts` e todas as páginas React.  
- **Comportamento runtime** (race conditions, double-submit, lógica de negócio) requer testes de integração e revisão de produto.  
- **Compliance** (LGPD/GDPR, retenção, DPA com sub-processadores) não foi avaliado neste relatório técnico.

---

*Fim do relatório. Para aplicar correções de código adicionais (ex.: endurecer uma política concreta de Storage), use Agent mode com o ficheiro/migração alvo.*
