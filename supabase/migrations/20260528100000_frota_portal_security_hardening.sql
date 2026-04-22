-- Endurecimento: submotorista só altera reservas do operador que o cadastrou (user_id alinhado)
-- e continua limitado a status/updated_at (triggers existentes).

drop policy if exists "reservas_transfer_update_as_frota_motorista" on public.reservas_transfer;
create policy "reservas_transfer_update_as_frota_motorista"
  on public.reservas_transfer
  for update
  to authenticated
  using (
    motorista_id is not null
    and trim(motorista_id) = (select auth.uid())::text
    and exists (
      select 1 from public.solicitacoes_motoristas sm
      where sm.portal_auth_user_id = (select auth.uid())
        and sm.user_id = user_id
    )
  )
  with check (
    motorista_id is not null
    and trim(motorista_id) = (select auth.uid())::text
    and exists (
      select 1 from public.solicitacoes_motoristas sm
      where sm.portal_auth_user_id = (select auth.uid())
        and sm.user_id = user_id
    )
  );

drop policy if exists "reservas_grupos_update_as_frota_motorista" on public.reservas_grupos;
create policy "reservas_grupos_update_as_frota_motorista"
  on public.reservas_grupos
  for update
  to authenticated
  using (
    motorista_id is not null
    and motorista_id = (select auth.uid())
    and exists (
      select 1 from public.solicitacoes_motoristas sm
      where sm.portal_auth_user_id = (select auth.uid())
        and sm.user_id = user_id
    )
  )
  with check (
    motorista_id is not null
    and motorista_id = (select auth.uid())
    and exists (
      select 1 from public.solicitacoes_motoristas sm
      where sm.portal_auth_user_id = (select auth.uid())
        and sm.user_id = user_id
    )
  );

create or replace function public.trg_reservas_transfer_frota_motorista_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_frota boolean;
begin
  select exists (
    select 1 from public.solicitacoes_motoristas sm
    where sm.portal_auth_user_id = auth.uid()
  ) into v_frota;

  if not v_frota then
    return new;
  end if;

  if not exists (
    select 1 from public.solicitacoes_motoristas sm
    where sm.portal_auth_user_id = auth.uid()
      and sm.user_id = old.user_id
  ) then
    raise exception 'Motorista da frota: reserva não pertence ao operador associado ao seu acesso.';
  end if;

  if trim(coalesce(old.motorista_id, '')) is distinct from auth.uid()::text then
    raise exception 'Motorista da frota: apenas reservas atribuídas a si.';
  end if;

  if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Apenas o campo status pode ser alterado pelo motorista da frota.';
  end if;

  return new;
end;
$$;

create or replace function public.trg_reservas_grupos_frota_motorista_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_frota boolean;
begin
  select exists (
    select 1 from public.solicitacoes_motoristas sm
    where sm.portal_auth_user_id = auth.uid()
  ) into v_frota;

  if not v_frota then
    return new;
  end if;

  if not exists (
    select 1 from public.solicitacoes_motoristas sm
    where sm.portal_auth_user_id = auth.uid()
      and sm.user_id = old.user_id
  ) then
    raise exception 'Motorista da frota: reserva não pertence ao operador associado ao seu acesso.';
  end if;

  if old.motorista_id is distinct from auth.uid() then
    raise exception 'Motorista da frota: apenas reservas atribuídas a si.';
  end if;

  if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Apenas o campo status pode ser alterado pelo motorista da frota.';
  end if;

  return new;
end;
$$;
