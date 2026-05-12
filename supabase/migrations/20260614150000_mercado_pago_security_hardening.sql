-- Endurecimento de billing Mercado Pago.
-- `service_role` continua a operar via backend, com bypass de RLS.

alter table public.user_plans enable row level security;
alter table public.mp_webhook_events enable row level security;

drop policy if exists "Admin master full access on user_plans" on public.user_plans;
drop policy if exists "Users can view own plan" on public.user_plans;
drop policy if exists user_plans_select_own on public.user_plans;

create policy user_plans_select_own
  on public.user_plans
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Sem INSERT/UPDATE/DELETE para utilizadores JWT:
-- `plano`, `billing_manual_override` e ids Mercado Pago são alterados apenas por backend/Edge com service_role.

drop policy if exists mp_webhook_events_service_only on public.mp_webhook_events;
create policy mp_webhook_events_service_only
  on public.mp_webhook_events
  for all
  to authenticated
  using (false)
  with check (false);

revoke all on public.mp_webhook_events from anon, authenticated;
