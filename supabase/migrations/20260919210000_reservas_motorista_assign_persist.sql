-- Dono do painel pode atribuir motorista; o mini portal vê a reserva pelo uid ou pelo id do cadastro.

CREATE OR REPLACE FUNCTION public.trg_reservas_transfer_frota_motorista_guard()
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

DROP POLICY IF EXISTS reservas_transfer_select_as_frota_motorista ON public.reservas_transfer;
CREATE POLICY reservas_transfer_select_as_frota_motorista
ON public.reservas_transfer
FOR SELECT
TO authenticated
USING (
  motorista_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.solicitacoes_motoristas sm
    WHERE sm.portal_auth_user_id = (SELECT auth.uid())
      AND sm.user_id = reservas_transfer.user_id
      AND sm.status = 'cadastrado'
      AND (
        btrim(reservas_transfer.motorista_id) = (SELECT auth.uid())::text
        OR btrim(reservas_transfer.motorista_id) = sm.id::text
      )
  )
);

DROP POLICY IF EXISTS reservas_grupos_select_as_frota_motorista ON public.reservas_grupos;
CREATE POLICY reservas_grupos_select_as_frota_motorista
ON public.reservas_grupos
FOR SELECT
TO authenticated
USING (
  motorista_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.solicitacoes_motoristas sm
    WHERE sm.portal_auth_user_id = (SELECT auth.uid())
      AND sm.user_id = reservas_grupos.user_id
      AND sm.status = 'cadastrado'
      AND (
        reservas_grupos.motorista_id::text = (SELECT auth.uid())::text
        OR reservas_grupos.motorista_id::text = sm.id::text
      )
  )
);
