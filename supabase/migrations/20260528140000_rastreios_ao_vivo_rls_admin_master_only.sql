-- Multitenant: SELECT/DELETE com is_platform_staff() expõem todos os rastreios a
-- admin_taxi / admin_transfer (mesmo padrão que veiculos_frota e financial_transactions).
-- Apenas admin_master mantém visão transversal; motorista continua a ver só user_id próprio.

drop policy if exists rastreios_ao_vivo_select_motorista_ou_staff on public.rastreios_ao_vivo;
create policy rastreios_ao_vivo_select_motorista_ou_staff
  on public.rastreios_ao_vivo for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_master((select auth.uid()))
  );

comment on policy rastreios_ao_vivo_select_motorista_ou_staff on public.rastreios_ao_vivo is
  'Motorista vê só os seus rastreios; leitura global só admin_master.';

drop policy if exists rastreios_ao_vivo_delete_motorista_ou_staff on public.rastreios_ao_vivo;
create policy rastreios_ao_vivo_delete_motorista_ou_staff
  on public.rastreios_ao_vivo for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_master((select auth.uid()))
  );

drop policy if exists rastreios_ao_vivo_pontos_select_motorista_ou_staff on public.rastreios_ao_vivo_pontos;
create policy rastreios_ao_vivo_pontos_select_motorista_ou_staff
  on public.rastreios_ao_vivo_pontos for select
  to authenticated
  using (
    exists (
      select 1
      from public.rastreios_ao_vivo r
      where r.id = rastreios_ao_vivo_pontos.rastreio_id
        and (
          r.user_id = (select auth.uid())
          or public.is_admin_master((select auth.uid()))
        )
    )
  );

drop policy if exists rastreios_ao_vivo_pontos_delete_motorista_ou_staff on public.rastreios_ao_vivo_pontos;
create policy rastreios_ao_vivo_pontos_delete_motorista_ou_staff
  on public.rastreios_ao_vivo_pontos for delete
  to authenticated
  using (
    exists (
      select 1
      from public.rastreios_ao_vivo r
      where r.id = rastreios_ao_vivo_pontos.rastreio_id
        and (
          r.user_id = (select auth.uid())
          or public.is_admin_master((select auth.uid()))
        )
    )
  );
