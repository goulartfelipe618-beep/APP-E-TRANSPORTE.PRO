-- Migração de billing Stripe -> Mercado Pago.
-- Mantém `billing_manual_override` como trava administrativa genérica:
-- quando true, webhooks de pagamento não alteram o plano do usuário.

alter table public.user_plans
  add column if not exists billing_manual_override boolean not null default false;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_plans' and column_name = 'stripe_customer_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_plans' and column_name = 'mp_customer_id'
  ) then
    alter table public.user_plans rename column stripe_customer_id to mp_customer_id;
  else
    alter table public.user_plans add column if not exists mp_customer_id text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_plans' and column_name = 'stripe_subscription_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_plans' and column_name = 'mp_subscription_id'
  ) then
    alter table public.user_plans rename column stripe_subscription_id to mp_subscription_id;
  else
    alter table public.user_plans add column if not exists mp_subscription_id text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_plans' and column_name = 'stripe_price_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_plans' and column_name = 'mp_plan_id'
  ) then
    alter table public.user_plans rename column stripe_price_id to mp_plan_id;
  else
    alter table public.user_plans add column if not exists mp_plan_id text;
  end if;
end $$;

alter table public.user_plans
  add column if not exists mp_payment_id text;

drop index if exists public.user_plans_stripe_customer_id_key;
drop index if exists public.user_plans_stripe_subscription_id_key;
drop index if exists public.user_plans_stripe_price_id_key;

create unique index if not exists user_plans_mp_customer_id_key
  on public.user_plans (mp_customer_id)
  where mp_customer_id is not null;

create unique index if not exists user_plans_mp_subscription_id_key
  on public.user_plans (mp_subscription_id)
  where mp_subscription_id is not null;

create unique index if not exists user_plans_mp_payment_id_key
  on public.user_plans (mp_payment_id)
  where mp_payment_id is not null;

comment on column public.user_plans.billing_manual_override is
  'Quando true, webhooks Mercado Pago não alteram automaticamente o plano desta conta.';
comment on column public.user_plans.mp_customer_id is 'Mercado Pago customer/payer id.';
comment on column public.user_plans.mp_subscription_id is 'Mercado Pago preapproval/subscription id.';
comment on column public.user_plans.mp_plan_id is 'Identificador interno do plano Mercado Pago (ex.: standart_monthly, pro_annual).';
comment on column public.user_plans.mp_payment_id is 'Último pagamento Mercado Pago relacionado à assinatura.';

drop table if exists public.stripe_webhook_events;

create table if not exists public.mp_webhook_events (
  id text primary key,
  created_at timestamptz not null default now()
);

comment on table public.mp_webhook_events is
  'Ids/event keys Mercado Pago já processados (idempotência). Sem políticas: apenas service_role/backend.';

alter table public.mp_webhook_events enable row level security;
