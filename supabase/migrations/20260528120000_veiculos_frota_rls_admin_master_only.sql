-- Frota por conta: a política não pode usar is_platform_staff() no OR com user_id,
-- pois admin_taxi / admin_transfer em contas operacionais expõem TODAS as linhas.
-- Apenas admin_master mantém visão transversal (igual financial_transactions).

drop policy if exists veiculos_frota_select on public.veiculos_frota;
create policy veiculos_frota_select
on public.veiculos_frota for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_admin_master((select auth.uid()))
);

comment on policy veiculos_frota_select on public.veiculos_frota is
  'Motorista vê só user_id próprio; leitura global só admin_master.';

drop policy if exists veiculos_frota_insert on public.veiculos_frota;
create policy veiculos_frota_insert
on public.veiculos_frota for insert
to authenticated
with check (
  user_id = (select auth.uid())
  or public.is_admin_master((select auth.uid()))
);

drop policy if exists veiculos_frota_update on public.veiculos_frota;
create policy veiculos_frota_update
on public.veiculos_frota for update
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_admin_master((select auth.uid()))
)
with check (
  user_id = (select auth.uid())
  or public.is_admin_master((select auth.uid()))
);

drop policy if exists veiculos_frota_delete on public.veiculos_frota;
create policy veiculos_frota_delete
on public.veiculos_frota for delete
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_admin_master((select auth.uid()))
);
