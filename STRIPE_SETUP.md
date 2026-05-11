# Integração Stripe — passo a passo seguro

Este projeto usa **Stripe Checkout** em modo **subscrição** para planos **STANDART** e **PRÓ**. O plano na base (`public.user_plans`) só muda após a **Stripe** confirmar o pagamento via **webhook** assinado.

### Segurança: onde podem existir chaves

| Onde | O que |
|------|--------|
| **Supabase (recomendado)** | **Edge Function Secrets** no painel do projeto, ou `supabase secrets set` na CLI. É aqui que devem estar `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e os `STRIPE_PRICE_*`. |
| **Vercel / hosting do frontend** | Apenas `VITE_STRIPE_BILLING_ENABLED=true` (público). **Não** coloque `sk_`, `whsec_` nem `price_` no frontend. |
| **Login admin_master / painel da app** | **Não existe** ecrã para guardar chaves Stripe. O admin só gere **planos de utilizadores** e a opção «sincronização Stripe» — **nunca** introduza API keys no browser. |

Qualquer variável `VITE_*` vai parar ao bundle público: **proibido** para segredos Stripe.

**Atenção:** se criou os oito `STRIPE_PRICE_*` apenas no **Vercel** (ou noutro painel do frontend), o checkout **não** os utiliza. Tem de **repetir os mesmos nomes e valores** em **Supabase → Edge Functions → Secrets** (ou `supabase secrets set`). No Vercel basta `VITE_STRIPE_BILLING_ENABLED=true` para mostrar os botões.

---

## 1. O que foi implementado no código

| Peça | Função |
|------|--------|
| Migração SQL | Colunas `billing_manual_override`, `stripe_customer_id`, `stripe_subscription_id` em `user_plans`; tabela `stripe_webhook_events` (idempotência). |
| `stripe-create-checkout-session` | POST com JWT; corpo `{ plano, ciclo }` (`monthly` \| `quarterly` \| `semiannual` \| `annual`); metadata com `supabase_user_id` e `billing_cycle`. |
| `stripe-webhook` | Valida `Stripe-Signature`; processa `checkout.session.completed`, `checkout.session.async_payment_succeeded` / `async_payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`. |
| `admin-users` (`update_plan`) | `allow_stripe_billing`: se `false`, activa `billing_manual_override` — **admin_master** tem controlo total; webhooks ignoram esse utilizador. |
| `self-upgrade-plan` | Se `STRIPE_SECRET_KEY` + preços estão definidos, **bloqueia** upgrade pago sem checkout. |
| Painel | `VITE_STRIPE_BILLING_ENABLED=true` mostra botões «Subscrever»; retorno `?billing=success` actualiza o plano no ecrã. |

---

## 2. Painel Stripe (Dashboard) — configuração

### 2.1 Conta e modo

1. Crie conta em [https://stripe.com](https://stripe.com) (use **modo de teste** primeiro: toggle «Test mode» no canto).
2. Anote a **chave secreta** (`sk_test_...` / `sk_live_...`) em **Developers → API keys**.  
   - **Nunca** coloque isto no frontend nem em repositório público.

### 2.2 Produtos e preços — quatro ciclos por plano pago

| Plano na app | Na Stripe |
|--------------|-----------|
| **FREE** | **Não** crie produto — o FREE é só na base (`user_plans.plano = free`). |
| **STANDART** | Um produto com **quatro** preços recorrentes em **BRL**: mensal, a cada 3 meses, a cada 6 meses, anual. |
| **PRÓ** | Outro produto, também com **quatro** preços recorrentes (mesmos tipos de ciclo). |

Para cada produto (STANDART e PRÓ), crie os quatro preços no **Product catalog** (subscrição / recurring), em **BRL**. Na página do produto, em **Pricing**, copie o **API ID** de cada preço (`price_...`).

**Mapeamento no Supabase (oito secrets):**

| Secret | Conteúdo |
|--------|----------|
| `STRIPE_PRICE_STANDART_MONTHLY` | `price_...` mensal STANDART |
| `STRIPE_PRICE_STANDART_QUARTERLY` | `price_...` a cada 3 meses |
| `STRIPE_PRICE_STANDART_SEMIANNUAL` | `price_...` a cada 6 meses |
| `STRIPE_PRICE_STANDART_YEARLY` | `price_...` anual |
| `STRIPE_PRICE_PRO_MONTHLY` | `price_...` mensal PRÓ |
| `STRIPE_PRICE_PRO_QUARTERLY` | `price_...` a cada 3 meses |
| `STRIPE_PRICE_PRO_SEMIANNUAL` | `price_...` a cada 6 meses |
| `STRIPE_PRICE_PRO_YEARLY` | `price_...` anual |

**Legado:** se já usava apenas mensal, `STRIPE_PRICE_STANDART` e `STRIPE_PRICE_PRO` continuam a ser aceites **só para o ciclo mensal** até migrar para `*_MONTHLY`.

O webhook identifica o plano (STANDART vs PRÓ) pelo **Price ID** da subscrição — todos os ciclos de um mesmo plano devem estar mapeados nos secrets acima.

Se mudar valores na Stripe, atualize também os rótulos em `src/lib/stripeBillingCycles.ts` (só UI); o valor cobrado é sempre o da Stripe.

### 2.3 Webhook na Stripe (obrigatório) — a Stripe chama o Supabase

O webhook é configurado **no site da Stripe**, não no Supabase. A Stripe envia eventos **HTTP POST** para a sua Edge Function; o segredo `whsec_...` é gerado **pela Stripe** e você copia-o para o Supabase.

1. No Dashboard Stripe: **Developers** → **Webhooks** → **Add endpoint**.
2. **Endpoint URL** (exemplo com o project ref do ficheiro `supabase/config.toml`):  
   `https://lsfwmbpvithxqerfdlhy.supabase.co/functions/v1/stripe-webhook`  
   Substitua `lsfwmbpvithxqerfdlhy` pelo **Project ID** do seu projeto se for diferente (é o mesmo host de `VITE_SUPABASE_URL`).
3. **Description** (opcional): `Supabase stripe-webhook`.
4. **Events to send** → **Select events** e marque:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded` (métodos com confirmação diferida; ex.: alguns débitos)
   - `checkout.session.async_payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. **Add endpoint**.
6. Abra o endpoint criado → **Signing secret** → **Reveal** → copie o valor `whsec_...`.
7. Esse valor é o secret **`STRIPE_WEBHOOK_SECRET`** no Supabase (secção 3.2 abaixo). **Sem este par**, a função rejeita pedidos (assinatura inválida).

**Importante:** só faça isto **depois** de fazer **deploy** da função `stripe-webhook` no Supabase; caso contrário a Stripe receberá 404 nas tentativas de entrega.

### 2.4 URLs de retorno (Checkout)

Defina URLs **HTTPS** reais da sua app (substitua o domínio):

- **Success:** `https://app.seudominio.com/dashboard?billing=success`  
  (a Edge acrescenta `session_id={CHECKOUT_SESSION_ID}` se ainda não existir — a Stripe substitui ao redireccionar; a app remove `billing=success` e mostra toast; o plano efectivo vem do **webhook**, não deste URL sozinho.)
- **Cancel:** `https://app.seudominio.com/dashboard`

Estas vão para `STRIPE_CHECKOUT_SUCCESS_URL` e `STRIPE_CHECKOUT_CANCEL_URL`.

---

## 3. Supabase

### 3.1 Migração

O ficheiro `supabase/migrations/20260210120000_stripe_billing.sql` adiciona as colunas Stripe em `user_plans` e a tabela `stripe_webhook_events`.  
Se ainda não estiver aplicada no **seu** projeto: **SQL Editor** → colar o SQL → **Run**, ou `supabase db push` com o CLI ligado ao projeto.

### 3.2 Secrets das Edge Functions (painel Supabase)

Faça login em [https://supabase.com/dashboard](https://supabase.com/dashboard) → abra o **projeto** → menu **Edge Functions** → **Manage secrets** (ou **Project Settings → Edge Functions → Secrets**, conforme a versão do painel).

Adicione **um secret de cada vez** (nome exato, sem espaços):

| Nome do secret | Valor (exemplo / origem) |
|----------------|---------------------------|
| `STRIPE_SECRET_KEY` | Chave **Secret** da Stripe: **Developers → API keys** (`sk_test_...` ou `sk_live_...`). |
| `STRIPE_WEBHOOK_SECRET` | **Signing secret** do endpoint de webhook na Stripe (`whsec_...`), secção 2.3. |
| `STRIPE_PRICE_STANDART_MONTHLY`, `STRIPE_PRICE_STANDART_QUARTERLY`, `STRIPE_PRICE_STANDART_SEMIANNUAL`, `STRIPE_PRICE_STANDART_YEARLY` | IDs `price_...` STANDART (secção 2.2). |
| `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_QUARTERLY`, `STRIPE_PRICE_PRO_SEMIANNUAL`, `STRIPE_PRICE_PRO_YEARLY` | IDs `price_...` PRÓ (secção 2.2). |
| `STRIPE_PRICE_STANDART` / `STRIPE_PRICE_PRO` | Opcional, legado: só substitui o mensal se `*_MONTHLY` não existir. |
| `STRIPE_CHECKOUT_SUCCESS_URL` | URL HTTPS completa, ex.: `https://SEU_DOMINIO/dashboard?billing=success` |
| `STRIPE_CHECKOUT_CANCEL_URL` | URL HTTPS completa, ex.: `https://SEU_DOMINIO/dashboard` |

**Não** use o login **admin_master** da aplicação para isto — é tudo no **dashboard do Supabase** (ou CLI).

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente nas Edge Functions; não precisa duplicá-los nos secrets manuais.

#### Alternativa: CLI (máquina local)

Com [Supabase CLI](https://supabase.com/docs/guides/cli) autenticado e projeto ligado:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx --project-ref SEU_PROJECT_REF
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx --project-ref SEU_PROJECT_REF
supabase secrets set STRIPE_PRICE_STANDART_MONTHLY=price_xxx --project-ref SEU_PROJECT_REF
supabase secrets set STRIPE_PRICE_STANDART_QUARTERLY=price_xxx --project-ref SEU_PROJECT_REF
supabase secrets set STRIPE_PRICE_STANDART_SEMIANNUAL=price_xxx --project-ref SEU_PROJECT_REF
supabase secrets set STRIPE_PRICE_STANDART_YEARLY=price_xxx --project-ref SEU_PROJECT_REF
supabase secrets set STRIPE_PRICE_PRO_MONTHLY=price_xxx --project-ref SEU_PROJECT_REF
supabase secrets set STRIPE_PRICE_PRO_QUARTERLY=price_xxx --project-ref SEU_PROJECT_REF
supabase secrets set STRIPE_PRICE_PRO_SEMIANNUAL=price_xxx --project-ref SEU_PROJECT_REF
supabase secrets set STRIPE_PRICE_PRO_YEARLY=price_xxx --project-ref SEU_PROJECT_REF
supabase secrets set STRIPE_CHECKOUT_SUCCESS_URL="https://SEU_DOMINIO/dashboard?billing=success" --project-ref SEU_PROJECT_REF
supabase secrets set STRIPE_CHECKOUT_CANCEL_URL="https://SEU_DOMINIO/dashboard" --project-ref SEU_PROJECT_REF
```

Substitua `SEU_PROJECT_REF` pelo ID do projeto (ex.: `lsfwmbpvithxqerfdlhy`).

### 3.3 Deploy das funções

Na máquina local, com [Supabase CLI](https://supabase.com/docs/guides/cli) **autenticado** ao seu utilizador (`supabase login`) e projeto **ligado** (`supabase link --project-ref …`):

```bash
npm run deploy:stripe-functions
```

Equivalente:

```bash
supabase functions deploy stripe-create-checkout-session
supabase functions deploy stripe-webhook
```

Se aparecer **401 Unauthorized**, falta login ou o link ao projeto — o assistente no Cursor **não** consegue fazer deploy pelo MCP enquanto a sessão estiver em *Ask mode*; use *Agent mode* ou execute estes comandos no seu terminal.

Confirme em `supabase/config.toml` que `stripe-webhook` tem `verify_jwt = false` (webhooks da Stripe não enviam JWT de utilizador). A função `stripe-checkout-available` também fica com `verify_jwt = false` (GET público com `apikey` anon).

### 3.4 Testar em modo teste

1. Use cartões de teste Stripe (ex.: `4242 4242 4242 4242`, qualquer CVC/futuro).
2. No Dashboard Stripe → **Developers → Webhooks**, abra o endpoint e verifique **entregas** (200 = assinatura válida e handler ok).

---

## 4. Frontend (Vercel / build)

Variáveis de ambiente **públicas**:

- `VITE_STRIPE_BILLING_ENABLED=true` — mostra «Subscrever STANDART / PRÓ» no diálogo de planos.

Não é necessário `VITE_STRIPE_PUBLISHABLE_KEY` para este fluxo (redirect server-side para `checkout.stripe.com`).

---

## 5. Admin master — controlo total

- **Cadastrados → coroa (alterar plano):** escolha FREE / STANDART / PRÓ.
- **«Permitir sincronização Stripe»** (marcado = `allow_stripe_billing: true`): a Stripe pode actualizar o plano conforme subscrição.
- **Desmarcado:** `billing_manual_override = true` — webhooks **não** alteram esse utilizador (cortesias, disputas, contas especiais).
- **Finalizar lead** da landing continua a marcar plano pago como **manual** (Stripe não sobrescreve automaticamente).

Para um cliente voltar a pagar pela Stripe após ter sido posto em «só manual», o admin marca de novo **Permitir sincronização Stripe** (e o plano desejado) ou o utilizador contacta suporte.

---

## 6. Checklist de segurança

- [ ] `sk_live_` / `whsec_` só em Supabase Secrets (ou CI privado), nunca no Git.
- [ ] Webhook só aceita pedidos com assinatura válida (`stripe-webhook`).
- [ ] Não confiar no URL `success` sozinho — o desbloqueio vem do webhook.
- [ ] Em produção, usar sempre **HTTPS** nas URLs de retorno.
- [ ] Rever em Stripe os eventos entregues após o primeiro pagamento real.

---

## 7. Resolução de problemas

| Sintoma | Acção |
|---------|--------|
| «Pagamentos não configurados no servidor» | Faltam secrets ou URLs no Supabase. |
| Pagamento ok, plano não muda | Webhook: ver logs da função; evento falhou ou `billing_manual_override` está activo. |
| 401 no checkout | Sessão expirada ou função com `verify_jwt` mal configurada. |
| Assinatura inválida no webhook | `STRIPE_WEBHOOK_SECRET` errado ou corpo alterado por proxy (deve ser raw body). |
| «No valid payment method types» / 500 no checkout | A função envia `payment_method_types=card`. Em **Stripe → Definições → Métodos de pagamento**, active **Cartão** (e métodos compatíveis com **BRL** / subscrições no seu país). |
| CSP bloqueia script inline no painel | O `vercel.json` inclui hash do script de tema em `index.html`; se alterar esse bloco, actualize o hash em `script-src` ou volte a copiar o valor que o browser mostra na consola. |

Para suporte Stripe: [https://support.stripe.com](https://support.stripe.com) e documentação [https://stripe.com/docs/webhooks](https://stripe.com/docs/webhooks).
