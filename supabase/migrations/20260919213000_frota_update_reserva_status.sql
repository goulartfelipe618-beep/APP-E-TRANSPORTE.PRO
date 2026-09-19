-- Mini portal: gravar estado mesmo quando motorista_id é o uid do portal ou o id do cadastro.

CREATE OR REPLACE FUNCTION public.trg_reservas_grupos_frota_motorista_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  v_frota boolean;
begin
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

DROP POLICY IF EXISTS reservas_transfer_update_as_frota_motorista ON public.reservas_transfer;
CREATE POLICY reservas_transfer_update_as_frota_motorista
ON public.reservas_transfer
FOR UPDATE
TO authenticated
USING (
  motorista_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.solicitacoes_motoristas sm
    WHERE sm.portal_auth_user_id = (SELECT auth.uid())
      AND sm.user_id = reservas_transfer.user_id
      AND sm.status = 'cadastrado'
      AND (
        btrim(reservas_transfer.motorista_id) = (SELECT auth.uid())::text
        OR btrim(reservas_transfer.motorista_id) = sm.id::text
      )
  )
)
WITH CHECK (
  motorista_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.solicitacoes_motoristas sm
    WHERE sm.portal_auth_user_id = (SELECT auth.uid())
      AND sm.user_id = reservas_transfer.user_id
      AND sm.status = 'cadastrado'
      AND (
        btrim(reservas_transfer.motorista_id) = (SELECT auth.uid())::text
        OR btrim(reservas_transfer.motorista_id) = sm.id::text
      )
  )
);

DROP POLICY IF EXISTS reservas_grupos_update_as_frota_motorista ON public.reservas_grupos;
CREATE POLICY reservas_grupos_update_as_frota_motorista
ON public.reservas_grupos
FOR UPDATE
TO authenticated
USING (
  motorista_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.solicitacoes_motoristas sm
    WHERE sm.portal_auth_user_id = (SELECT auth.uid())
      AND sm.user_id = reservas_grupos.user_id
      AND sm.status = 'cadastrado'
      AND (
        reservas_grupos.motorista_id::text = (SELECT auth.uid())::text
        OR reservas_grupos.motorista_id::text = sm.id::text
      )
  )
)
WITH CHECK (
  motorista_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.solicitacoes_motoristas sm
    WHERE sm.portal_auth_user_id = (SELECT auth.uid())
      AND sm.user_id = reservas_grupos.user_id
      AND sm.status = 'cadastrado'
      AND (
        reservas_grupos.motorista_id::text = (SELECT auth.uid())::text
        OR reservas_grupos.motorista_id::text = sm.id::text
      )
  )
);

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
  v_status text := btrim(coalesce(p_status, ''));
begin
  if v_uid is null then
    raise exception 'Sessão inválida.';
  end if;
  if v_status = '' then
    raise exception 'Estado inválido.';
  end if;
  if v_status in ('confirmado', 'confirmada') then
    v_status := 'confirmada';
  end if;

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
