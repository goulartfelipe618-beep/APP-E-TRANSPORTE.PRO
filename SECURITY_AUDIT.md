# Security Audit Report — 2026-05-11

## Vulnerabilidades Críticas Encontradas e Corrigidas

- [x] Webhook Mercado Pago aceitava eventos sem segredo quando `MP_WEBHOOK_SECRET` estava ausente.
  - Antes:
    ```js
    const secret = process.env.MP_WEBHOOK_SECRET?.trim();
    if (!secret) return { ok: true };
    ```
  - Depois:
    ```js
    if (!secret && process.env.NODE_ENV === "production") {
      return { ok: false, status: 500, error: "Webhook Mercado Pago não configurado" };
    }
    ```

- [x] Webhook Mercado Pago não validava janela de timestamp.
  - Antes: validava apenas `x-signature`, `x-request-id` e `data.id`.
  - Depois:
    ```js
    const tsNum = Number(ts);
    const ageSecs = Date.now() / 1000 - tsNum;
    if (ageSecs > 300 || ageSecs < -60) {
      return { ok: false, status: 401, error: "Webhook timestamp fora do intervalo" };
    }
    ```

- [x] `GET /api/payments/status/:paymentId` retornava status sem provar que o pagamento pertencia ao usuário autenticado.
  - Antes: buscava no Mercado Pago e retornava `id/status`.
  - Depois: compara `external_reference` ou `user_plans.mp_payment_id/mp_subscription_id` com `req.supabaseUser.id`; caso contrário retorna `403`.

- [x] RLS de billing permitia acesso administrativo direto via JWT em `user_plans`.
  - Antes: policy `Admin master full access on user_plans`.
  - Depois: apenas `user_plans_select_own`; alterações de plano/billing ficam restritas ao backend/Edge com `service_role`.

## Vulnerabilidades Médias Encontradas e Corrigidas

- [x] Rate limit de criação de pagamento estava em 60/15min por IP.
  - Depois: `5/15min` por IP e `5/15min` por `user_id` autenticado.

- [x] Logs não mascaravam algumas chaves específicas de pagamento.
  - Depois: `card_token_id`, `mp_access_token`, `mp_webhook_secret`, `service_role_key`, `cvv`, `card_number` e `identification` entram na lista de metadados redigidos.

- [x] Resposta de erro genérica em falhas internas de criação de pagamento.
  - Antes: poderia retornar `e.message`.
  - Depois: retorna `"Erro ao criar pagamento."` e loga detalhe apenas internamente.

- [x] Logs de auditoria de mudança de plano adicionados.
  - Evento: `plan_changed` com `userId`, `plano`, IDs Mercado Pago, `timestamp` e `source` (`api` ou `webhook`).

- [x] Placeholders `APP_USR-...` removidos de arquivos versionados atuais.
  - Substituídos por `<mercado-pago-public-key>` e `<mercado-pago-access-token>`.

## Configurações Verificadas e OK

- [x] `.gitignore` bloqueia `.env`, `.env.*`, `.env.local` e `.env.production`; mantém apenas `.env.example`.
- [x] Nenhuma chave real `APP_USR-...` encontrada nos arquivos versionados atuais.
- [x] Busca no histórico encontrou apenas placeholders antigos em `.env.example` e `MERCADO_PAGO_SETUP.md`, não valores reais completos.
- [x] `POST /api/payments/create-preference` usa `authSupabaseMiddleware({ optional: false })`.
- [x] `external_reference` é criado com `req.supabaseUser.id`, nunca com `userId` vindo do body.
- [x] Body de criação de pagamento é validado com Zod e `.strict()`.
- [x] `installments` é inteiro entre 1 e 12.
- [x] `token` do Card Payment Brick não é armazenado em `localStorage`.
- [x] Dados de cartão/CVV/número completo não passam por inputs próprios da aplicação; ficam no Brick Mercado Pago.
- [x] `mp_webhook_events.id` possui índice único via primary key.
- [x] `mp_webhook_events` tem RLS habilitado com policy `false`; apenas `service_role` faz insert por bypass.
- [x] `user_plans` tem RLS habilitado com SELECT apenas do próprio `user_id`.
- [x] CORS global é aplicado antes das rotas; em produção sem `ALLOWED_ORIGINS`, CORS fica fechado.
- [x] Helmet está ativo com CSP, HSTS, `object-src 'none'`, `frame-ancestors 'none'` e `base-uri 'self'`.

## Observações de CSP

- O Card Payment Brick do Mercado Pago exige domínios adicionais além de `sdk.mercadopago.com`:
  - `https://http2.mlstatic.com`
  - `https://secure.mlstatic.com`
  - `https://api.mercadolibre.com`
  - `https://*.mlstatic.com`
  - `https://*.mercadopago.com`
- Também exige inline script dinâmico no SDK. Foi mantido `unsafe-inline` em `script-src` no header da Vercel para o Brick funcionar. Isso é uma exceção operacional controlada e documentada.

## Recomendações Futuras

- [ ] Migrar a CSP do Mercado Pago para nonces/hashes oficiais se o SDK passar a suportar valores estáveis.
- [ ] Adicionar testes automatizados de autorização para `/api/payments/status/:paymentId`.
- [ ] Monitorar logs `plan_changed` e alertar múltiplas tentativas de pagamento recusadas por usuário.
- [ ] Criar rotação periódica de `MP_WEBHOOK_SECRET` e `MP_ACCESS_TOKEN`.
- [ ] Remover commits antigos com placeholders `APP_USR-...` apenas se a equipe decidir reescrever histórico Git; não havia valor real detectado.
