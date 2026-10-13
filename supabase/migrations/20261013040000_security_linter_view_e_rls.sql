-- O painel lê o próprio status sem a view ignorar o usuário.
-- As colunas internas de cursor e hash continuam sem GRANT.
-- O motorista continua vendo só a ficha cujo login é o dele.
-- user_metadata sai das políticas: o usuário pode editar esse campo.

grant select (
  user_id,
  enabled,
  last_run_at,
  last_run_date_sp,
  last_status,
  last_error,
  last_stats,
  last_prefix,
  created_at,
  updated_at
) on table public.r2_auto_backup_settings to authenticated;

drop policy if exists r2_auto_backup_settings_select_own on public.r2_auto_backup_settings;
create policy r2_auto_backup_settings_select_own
  on public.r2_auto_backup_settings
  for select
  to authenticated
  using (user_id = (select auth.uid()));

alter view public.r2_auto_backup_status set (security_invoker = true);

drop policy if exists reserva_motoristas_extra_motorista_select on public.reserva_motoristas_extra;
create policy reserva_motoristas_extra_motorista_select
  on public.reserva_motoristas_extra
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.solicitacoes_motoristas sm
      where sm.portal_auth_user_id = (select auth.uid())
        and sm.status = 'cadastrado'
        and sm.user_id = reserva_motoristas_extra.user_id
        and btrim(reserva_motoristas_extra.motorista_id) in (sm.id::text, sm.portal_auth_user_id::text)
    )
  );

drop policy if exists reservas_transfer_select_as_frota_motorista on public.reservas_transfer;
create policy reservas_transfer_select_as_frota_motorista
  on public.reservas_transfer
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.solicitacoes_motoristas sm
      where sm.portal_auth_user_id = (select auth.uid())
        and sm.status = 'cadastrado'
        and sm.user_id = reservas_transfer.user_id
        and btrim(coalesce(reservas_transfer.motorista_id, '')) in (sm.id::text, sm.portal_auth_user_id::text)
    )
  );

drop policy if exists reservas_transfer_extra_motorista_select on public.reservas_transfer;
create policy reservas_transfer_extra_motorista_select
  on public.reservas_transfer
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.reserva_motoristas_extra e
      join public.solicitacoes_motoristas sm
        on sm.portal_auth_user_id = (select auth.uid())
       and sm.status = 'cadastrado'
       and sm.user_id = reservas_transfer.user_id
       and e.user_id = sm.user_id
      where e.reserva_kind = 'transfer'
        and e.reserva_id = reservas_transfer.id
        and btrim(e.motorista_id) in (sm.id::text, sm.portal_auth_user_id::text)
    )
  );

drop policy if exists reservas_grupos_select_as_frota_motorista on public.reservas_grupos;
create policy reservas_grupos_select_as_frota_motorista
  on public.reservas_grupos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.solicitacoes_motoristas sm
      where sm.portal_auth_user_id = (select auth.uid())
        and sm.status = 'cadastrado'
        and sm.user_id = reservas_grupos.user_id
        and btrim(coalesce(reservas_grupos.motorista_id::text, '')) in (sm.id::text, sm.portal_auth_user_id::text)
    )
  );

drop policy if exists reservas_grupos_extra_motorista_select on public.reservas_grupos;
create policy reservas_grupos_extra_motorista_select
  on public.reservas_grupos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.reserva_motoristas_extra e
      join public.solicitacoes_motoristas sm
        on sm.portal_auth_user_id = (select auth.uid())
       and sm.status = 'cadastrado'
       and sm.user_id = reservas_grupos.user_id
       and e.user_id = sm.user_id
      where e.reserva_kind = 'grupo'
        and e.reserva_id = reservas_grupos.id
        and btrim(e.motorista_id) in (sm.id::text, sm.portal_auth_user_id::text)
    )
  );
