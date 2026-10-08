-- Motoristas adicionais de uma reserva. O motorista_id principal das reservas antigas não é reescrito.

CREATE TABLE IF NOT EXISTS public.reserva_motoristas_extra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reserva_kind text NOT NULL CHECK (reserva_kind IN ('transfer', 'grupo')),
  reserva_id uuid NOT NULL,
  motorista_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserva_motoristas_extra_unique UNIQUE (reserva_kind, reserva_id, motorista_id)
);

CREATE INDEX IF NOT EXISTS reserva_motoristas_extra_reserva_idx
  ON public.reserva_motoristas_extra (reserva_kind, reserva_id);

CREATE INDEX IF NOT EXISTS reserva_motoristas_extra_motorista_idx
  ON public.reserva_motoristas_extra (motorista_id);

ALTER TABLE public.reserva_motoristas_extra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reserva_motoristas_extra_owner ON public.reserva_motoristas_extra;
CREATE POLICY reserva_motoristas_extra_owner
  ON public.reserva_motoristas_extra
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      (reserva_kind = 'transfer' AND EXISTS (
        SELECT 1 FROM public.reservas_transfer r
        WHERE r.id = reserva_id AND r.user_id = auth.uid()
      ))
      OR (reserva_kind = 'grupo' AND EXISTS (
        SELECT 1 FROM public.reservas_grupos g
        WHERE g.id = reserva_id AND g.user_id = auth.uid()
      ))
    )
  );

DROP POLICY IF EXISTS reserva_motoristas_extra_motorista_select ON public.reserva_motoristas_extra;
CREATE POLICY reserva_motoristas_extra_motorista_select
  ON public.reserva_motoristas_extra
  FOR SELECT
  TO authenticated
  USING (
    btrim(motorista_id) = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.solicitacoes_motoristas sm
      WHERE sm.portal_auth_user_id = auth.uid()
        AND sm.user_id = reserva_motoristas_extra.user_id
        AND sm.status = 'cadastrado'
        AND sm.id::text = btrim(reserva_motoristas_extra.motorista_id)
    )
  );

DROP POLICY IF EXISTS reservas_transfer_extra_motorista_select ON public.reservas_transfer;
CREATE POLICY reservas_transfer_extra_motorista_select
  ON public.reservas_transfer
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.reserva_motoristas_extra e
      JOIN public.solicitacoes_motoristas sm
        ON sm.portal_auth_user_id = auth.uid()
       AND sm.user_id = reservas_transfer.user_id
       AND sm.status = 'cadastrado'
      WHERE e.reserva_kind = 'transfer'
        AND e.reserva_id = reservas_transfer.id
        AND (btrim(e.motorista_id) = auth.uid()::text OR btrim(e.motorista_id) = sm.id::text)
    )
  );

DROP POLICY IF EXISTS reservas_grupos_extra_motorista_select ON public.reservas_grupos;
CREATE POLICY reservas_grupos_extra_motorista_select
  ON public.reservas_grupos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.reserva_motoristas_extra e
      JOIN public.solicitacoes_motoristas sm
        ON sm.portal_auth_user_id = auth.uid()
       AND sm.user_id = reservas_grupos.user_id
       AND sm.status = 'cadastrado'
      WHERE e.reserva_kind = 'grupo'
        AND e.reserva_id = reservas_grupos.id
        AND (btrim(e.motorista_id) = auth.uid()::text OR btrim(e.motorista_id) = sm.id::text)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reserva_motoristas_extra TO authenticated;
GRANT ALL ON public.reserva_motoristas_extra TO service_role;

CREATE OR REPLACE FUNCTION public.get_frota_motorista_reservas()
RETURNS TABLE(
  kind text,
  id uuid,
  numero_reserva integer,
  status text,
  motorista_id text,
  tipo_viagem text,
  perna_viagem text,
  ida_data text,
  ida_hora text,
  volta_data text,
  volta_hora text,
  por_hora_data text,
  por_hora_hora text,
  ida_embarque text,
  ida_desembarque text,
  volta_embarque text,
  volta_desembarque text,
  por_hora_endereco_inicio text,
  por_hora_ponto_encerramento text,
  data_ida text,
  hora_ida text,
  data_retorno text,
  hora_retorno text,
  embarque text,
  destino text,
  num_passageiros integer,
  valor_base numeric,
  desconto numeric,
  valor_total numeric,
  repasse_motorista numeric,
  observacoes text,
  faturado boolean,
  esconder_valores boolean,
  categoria_veiculo text,
  trajetos jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    'transfer'::text AS kind,
    r.id,
    r.numero_reserva,
    r.status,
    nullif(trim(r.motorista_id), '') AS motorista_id,
    r.tipo_viagem,
    r.perna_viagem,
    r.ida_data::text,
    r.ida_hora::text,
    r.volta_data::text,
    r.volta_hora::text,
    r.por_hora_data::text,
    r.por_hora_hora::text,
    r.ida_embarque,
    r.ida_desembarque,
    r.volta_embarque,
    r.volta_desembarque,
    r.por_hora_endereco_inicio,
    r.por_hora_ponto_encerramento,
    NULL::text AS data_ida,
    NULL::text AS hora_ida,
    NULL::text AS data_retorno,
    NULL::text AS hora_retorno,
    NULL::text AS embarque,
    NULL::text AS destino,
    CASE
      WHEN r.tipo_viagem = 'por_hora' THEN r.por_hora_passageiros
      WHEN r.tipo_viagem = 'multiplos_trajetos' THEN r.ida_passageiros
      WHEN r.perna_viagem = 'volta' THEN COALESCE(r.volta_passageiros, r.ida_passageiros)
      ELSE r.ida_passageiros
    END AS num_passageiros,
    CASE WHEN r.esconder_valores THEN NULL ELSE r.valor_base END AS valor_base,
    CASE WHEN r.esconder_valores THEN NULL ELSE r.desconto END AS desconto,
    CASE WHEN r.esconder_valores THEN NULL ELSE r.valor_total END AS valor_total,
    r.repasse_motorista,
    r.observacoes,
    r.faturado,
    r.esconder_valores,
    r.categoria_veiculo,
    COALESCE(r.trajetos, '[]'::jsonb) AS trajetos
  FROM public.reservas_transfer r
  WHERE (
      r.motorista_id IS NOT NULL
      AND nullif(trim(r.motorista_id), '') = (SELECT auth.uid())::text
      OR EXISTS (
        SELECT 1
        FROM public.reserva_motoristas_extra e
        JOIN public.solicitacoes_motoristas smx
          ON smx.portal_auth_user_id = (SELECT auth.uid())
         AND smx.user_id = r.user_id
         AND smx.status = 'cadastrado'
        WHERE e.reserva_kind = 'transfer'
          AND e.reserva_id = r.id
          AND (btrim(e.motorista_id) = (SELECT auth.uid())::text OR btrim(e.motorista_id) = smx.id::text)
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.solicitacoes_motoristas sm
      WHERE sm.portal_auth_user_id = (SELECT auth.uid())
        AND sm.user_id = r.user_id
        AND sm.status = 'cadastrado'
    )

  UNION ALL

  SELECT
    'grupo'::text AS kind,
    g.id,
    g.numero_reserva,
    g.status,
    g.motorista_id::text AS motorista_id,
    NULL::text AS tipo_viagem,
    g.perna_viagem,
    NULL::text AS ida_data,
    NULL::text AS ida_hora,
    NULL::text AS volta_data,
    NULL::text AS volta_hora,
    NULL::text AS por_hora_data,
    NULL::text AS por_hora_hora,
    NULL::text AS ida_embarque,
    NULL::text AS ida_desembarque,
    NULL::text AS volta_embarque,
    NULL::text AS volta_desembarque,
    NULL::text AS por_hora_endereco_inicio,
    NULL::text AS por_hora_ponto_encerramento,
    g.data_ida::text,
    g.hora_ida::text,
    g.data_retorno::text,
    g.hora_retorno::text,
    g.embarque,
    g.destino,
    g.num_passageiros,
    g.valor_base,
    g.desconto,
    g.valor_total,
    g.repasse_motorista,
    g.observacoes_viagem AS observacoes,
    false AS faturado,
    false AS esconder_valores,
    NULL::text AS categoria_veiculo,
    '[]'::jsonb AS trajetos
  FROM public.reservas_grupos g
  WHERE (
      g.motorista_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.reserva_motoristas_extra e
        JOIN public.solicitacoes_motoristas smx
          ON smx.portal_auth_user_id = (SELECT auth.uid())
         AND smx.user_id = g.user_id
         AND smx.status = 'cadastrado'
        WHERE e.reserva_kind = 'grupo'
          AND e.reserva_id = g.id
          AND (btrim(e.motorista_id) = (SELECT auth.uid())::text OR btrim(e.motorista_id) = smx.id::text)
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.solicitacoes_motoristas sm
      WHERE sm.portal_auth_user_id = (SELECT auth.uid())
        AND sm.user_id = g.user_id
        AND sm.status = 'cadastrado'
    )
  ORDER BY numero_reserva DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_frota_motorista_reservas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_frota_motorista_reservas() TO authenticated;

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
            or exists (
              select 1 from public.reserva_motoristas_extra e
              where e.reserva_kind = 'transfer'
                and e.reserva_id = r.id
                and (btrim(e.motorista_id) = v_uid::text or btrim(e.motorista_id) = sm.id::text)
            )
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
            or exists (
              select 1 from public.reserva_motoristas_extra e
              where e.reserva_kind = 'grupo'
                and e.reserva_id = g.id
                and (btrim(e.motorista_id) = v_uid::text or btrim(e.motorista_id) = sm.id::text)
            )
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
