-- Mini painel: a reserva só aparece para motoristas atribuídos (principal + extras).
-- Não apaga dados. Não abre SELECT para toda a frota.

REVOKE ALL ON TABLE public.reserva_motoristas_extra FROM PUBLIC;
REVOKE ALL ON TABLE public.reserva_motoristas_extra FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reserva_motoristas_extra TO authenticated;
GRANT ALL ON TABLE public.reserva_motoristas_extra TO service_role;

DROP POLICY IF EXISTS reserva_motoristas_extra_owner ON public.reserva_motoristas_extra;
CREATE POLICY reserva_motoristas_extra_owner
  ON public.reserva_motoristas_extra
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      (reserva_kind = 'transfer' AND EXISTS (
        SELECT 1 FROM public.reservas_transfer r
        WHERE r.id = reserva_id AND r.user_id = (SELECT auth.uid())
      ))
      OR (reserva_kind = 'grupo' AND EXISTS (
        SELECT 1 FROM public.reservas_grupos g
        WHERE g.id = reserva_id AND g.user_id = (SELECT auth.uid())
      ))
    )
  );

DROP POLICY IF EXISTS reserva_motoristas_extra_motorista_select ON public.reserva_motoristas_extra;
CREATE POLICY reserva_motoristas_extra_motorista_select
  ON public.reserva_motoristas_extra
  FOR SELECT
  TO authenticated
  USING (
    btrim(motorista_id) = ((SELECT auth.uid()))::text
    OR EXISTS (
      SELECT 1 FROM public.solicitacoes_motoristas sm
      WHERE sm.portal_auth_user_id = (SELECT auth.uid())
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
        ON sm.portal_auth_user_id = (SELECT auth.uid())
       AND sm.user_id = reservas_transfer.user_id
       AND sm.status = 'cadastrado'
      WHERE e.reserva_kind = 'transfer'
        AND e.reserva_id = reservas_transfer.id
        AND btrim(e.motorista_id) IN (((SELECT auth.uid()))::text, sm.id::text)
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
        ON sm.portal_auth_user_id = (SELECT auth.uid())
       AND sm.user_id = reservas_grupos.user_id
       AND sm.status = 'cadastrado'
      WHERE e.reserva_kind = 'grupo'
        AND e.reserva_id = reservas_grupos.id
        AND btrim(e.motorista_id) IN (((SELECT auth.uid()))::text, sm.id::text)
    )
  );

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
  WHERE EXISTS (
    SELECT 1
    FROM public.solicitacoes_motoristas sm
    WHERE sm.portal_auth_user_id = (SELECT auth.uid())
      AND sm.user_id = r.user_id
      AND sm.status = 'cadastrado'
      AND (
        btrim(coalesce(r.motorista_id, '')) IN (((SELECT auth.uid()))::text, sm.id::text)
        OR EXISTS (
          SELECT 1
          FROM public.reserva_motoristas_extra e
          WHERE e.reserva_kind = 'transfer'
            AND e.reserva_id = r.id
            AND btrim(e.motorista_id) IN (((SELECT auth.uid()))::text, sm.id::text)
        )
      )
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
    NULL::text AS hora_ida,
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
  WHERE EXISTS (
    SELECT 1
    FROM public.solicitacoes_motoristas sm
    WHERE sm.portal_auth_user_id = (SELECT auth.uid())
      AND sm.user_id = g.user_id
      AND sm.status = 'cadastrado'
      AND (
        btrim(coalesce(g.motorista_id::text, '')) IN (((SELECT auth.uid()))::text, sm.id::text)
        OR EXISTS (
          SELECT 1
          FROM public.reserva_motoristas_extra e
          WHERE e.reserva_kind = 'grupo'
            AND e.reserva_id = g.id
            AND btrim(e.motorista_id) IN (((SELECT auth.uid()))::text, sm.id::text)
        )
      )
  )
  ORDER BY numero_reserva DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_frota_motorista_reservas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_frota_motorista_reservas() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_frota_motorista_reservas() TO authenticated;

NOTIFY pgrst, 'reload schema';
