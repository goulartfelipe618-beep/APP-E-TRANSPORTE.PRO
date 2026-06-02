-- Mini painel do motorista da frota: cada submotorista vê apenas as reservas
-- atribuídas ao seu auth.uid(), com detalhes operacionais e sem contacto do cliente.

DROP FUNCTION IF EXISTS public.get_frota_motorista_reservas();

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
  observacoes text
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
      WHEN r.perna_viagem = 'volta' THEN COALESCE(r.volta_passageiros, r.ida_passageiros)
      ELSE r.ida_passageiros
    END AS num_passageiros,
    r.valor_base,
    r.desconto,
    r.valor_total,
    r.repasse_motorista,
    r.observacoes
  FROM public.reservas_transfer r
  WHERE r.motorista_id IS NOT NULL
    AND nullif(trim(r.motorista_id), '') = (SELECT auth.uid())::text
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
    g.observacoes_viagem AS observacoes
  FROM public.reservas_grupos g
  WHERE g.motorista_id = (SELECT auth.uid())
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
