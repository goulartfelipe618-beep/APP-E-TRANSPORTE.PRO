# Mercado Pago — Checkout Transparente

## Variáveis

Frontend (build Vite):

```env
VITE_MP_BILLING_ENABLED=true
VITE_MP_PUBLIC_KEY=<mercado-pago-public-key>
NEXT_PUBLIC_MP_PUBLIC_KEY=<mercado-pago-public-key>
VITE_API_BASE_URL=https://api.seudominio.com
```

Backend Node (`server/` ou função Vercel em `api/[...path].mjs`):

```env
MP_ACCESS_TOKEN=<mercado-pago-access-token>
MP_PUBLIC_KEY=<mercado-pago-public-key>
MP_WEBHOOK_SECRET=<mercado-pago-webhook-secret>
MP_BACK_URL=https://app.seudominio.com/dashboard
APP_PUBLIC_URL=https://app.seudominio.com
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ALLOWED_ORIGINS=https://app.seudominio.com
```

## Endpoints

- `POST /api/payments/create-preference`
  - Requer `Authorization: Bearer <JWT Supabase>`.
  - Recebe o token gerado pelo Card Payment Brick e cria a assinatura recorrente Mercado Pago.

- `POST /api/webhooks/mercadopago`
  - Configurar no painel Mercado Pago.
  - Valida `x-signature` quando `MP_WEBHOOK_SECRET` está definido.
  - Eventos esperados: `payment.created`, `payment.updated`, `subscription_preapproval.updated`.

- `GET /api/payments/status/:paymentId`
  - Requer `Authorization: Bearer <JWT Supabase>`.
  - Consulta pagamento/assinatura e sincroniza `user_plans`.

## Planos

| Plano | Ciclo | Valor |
| --- | --- | ---: |
| STANDART | Mensal | R$ 89,90 |
| STANDART | Trimestral | R$ 239,70 |
| STANDART | Semestral | R$ 419,40 |
| STANDART | Anual | R$ 718,80 |
| PRÓ | Mensal | R$ 109,90 |
| PRÓ | Trimestral | R$ 299,70 |
| PRÓ | Semestral | R$ 539,40 |
| PRÓ | Anual | R$ 958,80 |

## Banco

Aplicar a migration:

```bash
supabase db push
```

Se o histórico remoto estiver divergente, aplicar o SQL de
`supabase/migrations/20260614130000_mercado_pago_billing.sql` pelo SQL Editor/Supabase MCP.
