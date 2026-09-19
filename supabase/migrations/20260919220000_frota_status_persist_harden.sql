-- Mini portal: gravar estado de forma idempotente e sem o trigger da frota a abortar o UPDATE.

CREATE OR REPLACE FUNCTION public.trg_reservas_transfer_frota_motorista_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  v_frota boolean;
begin
  if current_setting('app.frota_status_update', true) = 'on' then
    return new;
  end if;

  if auth.uid() is not null and new.user_id is not null and auth.uid() = new.user_id then
    return new;
  end if;

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

  if trim(coalesce(old.motorista_id, '')) is distinct from auth.uid()::text
     and not exists (
       select 1 from public.solicitacoes_motoristas sm
       where sm.portal_auth_user_id = auth.uid()
         and sm.user_id = old.user_id
         and sm.id::text = trim(coalesce(old.motorista_id, ''))
     ) then
    raise exception 'Motorista da frota: apenas reservas atribuídas a si.';
  end if;

  if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Apenas o campo status pode ser alterado pelo motorista da frota.';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trg_reservas_grupos_frota_motorista_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  v_frota boolean;
begin
  if current_setting('app.frota_status_update', true) = 'on' then
    return new;
  end if;

  if auth.uid() is not null and new.user_id is not null and auth.uid() = new.user_id then
    return new;
  end if;

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

  if old.motorista_id is distinct from auth.uid()
     and not exists (
       select 1 from public.solicitacoes_motoristas sm
       where sm.portal_auth_user_id = auth.uid()
         and sm.user_id = old.user_id
         and sm.id::text = old.motorista_id::text
     ) then
    raise exception 'Motorista da frota: apenas reservas atribuídas a si.';
  end if;

  if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Apenas o campo status pode ser alterado pelo motorista da frota.';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.frota_update_reserva_status(
  p_kind text,
  p_id uuid,
  p_status text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_new text;
  v_status text := lower(btrim(coalesce(p_status, '')));
begin
  if v_uid is null then
    raise exception 'Sessão inválida.';
  end if;

  v_status := translate(v_status, 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  v_status := regexp_replace(v_status, '[\s-]+', '_', 'g');

  if v_status in ('confirmado', 'confirmada') then
    v_status := 'confirmada';
  elsif v_status in ('concluido', 'concluida') then
    v_status := 'concluida';
  elsif v_status in ('cancelado', 'cancelada') then
    v_status := 'cancelada';
  elsif v_status in ('em_andamento', 'emandamento', 'andamento') then
    v_status := 'em_andamento';
  elsif v_status in ('pendente') then
    v_status := 'pendente';
  elsif v_status = '' then
    raise exception 'Estado inválido.';
  end if;

  perform set_config('app.frota_status_update', 'on', true);

  if p_kind = 'transfer' then
    update public.reservas_transfer r
    set status = v_status, updated_at = now()
    where r.id = p_id
      and exists (
        select 1 from public.solicitacoes_motoristas sm
        where sm.portal_auth_user_id = v_uid
          and sm.user_id = r.user_id
          and sm.status = 'cadastrado'
          and (
            btrim(coalesce(r.motorista_id, '')) = v_uid::text
            or btrim(coalesce(r.motorista_id, '')) = sm.id::text
          )
      )
    returning r.status into v_new;
  elsif p_kind = 'grupo' then
    update public.reservas_grupos g
    set status = v_status, updated_at = now()
    where g.id = p_id
      and exists (
        select 1 from public.solicitacoes_motoristas sm
        where sm.portal_auth_user_id = v_uid
          and sm.user_id = g.user_id
          and sm.status = 'cadastrado'
          and (
            g.motorista_id::text = v_uid::text
            or g.motorista_id::text = sm.id::text
          )
      )
    returning g.status into v_new;
  else
    raise exception 'Tipo de reserva inválido.';
  end if;

  if v_new is null then
    raise exception 'Não foi possível atualizar o estado desta reserva.';
  end if;
  return v_new;
end;
$function$;

REVOKE ALL ON FUNCTION public.frota_update_reserva_status(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.frota_update_reserva_status(text, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
