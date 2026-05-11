-- Stripe: colunas em user_plans + idempotência de webhooks (service role apenas).

ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS billing_manual_override boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_plans.billing_manual_override IS
  'Se true, apenas admin_master altera o plano; webhooks Stripe ignoram este utilizador.';

ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

COMMENT ON COLUMN public.user_plans.stripe_customer_id IS 'Stripe Customer id (cus_...).';
COMMENT ON COLUMN public.user_plans.stripe_subscription_id IS 'Stripe Subscription id (sub_...).';

CREATE UNIQUE INDEX IF NOT EXISTS user_plans_stripe_customer_id_key
  ON public.user_plans (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_plans_stripe_subscription_id_key
  ON public.user_plans (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id text PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stripe_webhook_events IS
  'Ids de eventos Stripe já processados (idempotência). Só service role.';

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Sem políticas: anon/authenticated não acede; service role bypassa RLS.
