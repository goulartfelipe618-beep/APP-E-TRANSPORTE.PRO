-- Mini painel: a reserva só entra se a ficha do login for deste administrador
-- e o motorista atribuído for esta ficha. Não apaga dados.

DROP POLICY IF EXISTS reserva_motoristas_extra_motorista_select ON public.reserva_motoristas_extra;
CREATE POLICY reserva_motoristas_extra_motorista_select
  ON public.reserva_motoristas_extra
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.solicitacoes_motoristas sm
      WHERE sm.portal_auth_user_id = (SELECT auth.uid())
        AND sm.status = 'cadastrado'
        AND sm.user_id = reserva_motoristas_extra.user_id
        AND btrim(reserva_motoristas_extra.motorista_id) IN (sm.id::text, sm.portal_auth_user_id::text)
        AND (
          coalesce(auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id', '') = ''
          OR sm.id::text = auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id'
        )
    )
  );

DROP POLICY IF EXISTS reservas_transfer_select_as_frota_motorista ON public.reservas_transfer;
CREATE POLICY reservas_transfer_select_as_frota_motorista
  ON public.reservas_transfer
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.solicitacoes_motoristas sm
      WHERE sm.portal_auth_user_id = (SELECT auth.uid())
        AND sm.status = 'cadastrado'
        AND sm.user_id = reservas_transfer.user_id
        AND btrim(coalesce(reservas_transfer.motorista_id, '')) IN (sm.id::text, sm.portal_auth_user_id::text)
        AND (
          coalesce(auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id', '') = ''
          OR sm.id::text = auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id'
        )
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
       AND sm.status = 'cadastrado'
       AND sm.user_id = reservas_transfer.user_id
       AND e.user_id = sm.user_id
      WHERE e.reserva_kind = 'transfer'
        AND e.reserva_id = reservas_transfer.id
        AND btrim(e.motorista_id) IN (sm.id::text, sm.portal_auth_user_id::text)
        AND (
          coalesce(auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id', '') = ''
          OR sm.id::text = auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id'
        )
    )
  );

DROP POLICY IF EXISTS reservas_grupos_select_as_frota_motorista ON public.reservas_grupos;
CREATE POLICY reservas_grupos_select_as_frota_motorista
  ON public.reservas_grupos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.solicitacoes_motoristas sm
      WHERE sm.portal_auth_user_id = (SELECT auth.uid())
        AND sm.status = 'cadastrado'
        AND sm.user_id = reservas_grupos.user_id
        AND btrim(coalesce(reservas_grupos.motorista_id::text, '')) IN (sm.id::text, sm.portal_auth_user_id::text)
        AND (
          coalesce(auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id', '') = ''
          OR sm.id::text = auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id'
        )
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
       AND sm.status = 'cadastrado'
       AND sm.user_id = reservas_grupos.user_id
       AND e.user_id = sm.user_id
      WHERE e.reserva_kind = 'grupo'
        AND e.reserva_id = reservas_grupos.id
        AND btrim(e.motorista_id) IN (sm.id::text, sm.portal_auth_user_id::text)
        AND (
          coalesce(auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id', '') = ''
          OR sm.id::text = auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id'
        )
    )
  );

DROP FUNCTION IF EXISTS public.get_frota_motorista_reservas();

CREATE FUNCTION public.get_frota_motorista_reservas()
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
  trajetos jsonb,
  owner_user_id uuid,
  acesso text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    'transfer'::text,
    r.id,
    r.numero_reserva,
    r.status,
    nullif(trim(r.motorista_id), ''),
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
    NULL::text,
    NULL::text,
    NULL::text,
    NULL::text,
    NULL::text,
    NULL::text,
    CASE
      WHEN r.tipo_viagem = 'por_hora' THEN r.por_hora_passageiros
      WHEN r.tipo_viagem = 'multiplos_trajetos' THEN r.ida_passageiros
      WHEN r.perna_viagem = 'volta' THEN COALESCE(r.volta_passageiros, r.ida_passageiros)
      ELSE r.ida_passageiros
    END,
    CASE WHEN r.esconder_valores THEN NULL ELSE r.valor_base END,
    CASE WHEN r.esconder_valores THEN NULL ELSE r.desconto END,
    CASE WHEN r.esconder_valores THEN NULL ELSE r.valor_total END,
    r.repasse_motorista,
    r.observacoes,
    r.faturado,
    r.esconder_valores,
    r.categoria_veiculo,
    COALESCE(r.trajetos, '[]'::jsonb),
    r.user_id,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.solicitacoes_motoristas sm
        WHERE sm.portal_auth_user_id = (SELECT auth.uid())
          AND sm.user_id = r.user_id
          AND sm.status = 'cadastrado'
          AND btrim(coalesce(r.motorista_id, '')) IN (sm.id::text, sm.portal_auth_user_id::text)
          AND (
            coalesce(auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id', '') = ''
            OR sm.id::text = auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id'
          )
      ) THEN 'principal'
      ELSE 'extra'
    END
  FROM public.reservas_transfer r
  WHERE EXISTS (
    SELECT 1
    FROM public.solicitacoes_motoristas sm
    WHERE sm.portal_auth_user_id = (SELECT auth.uid())
      AND sm.user_id = r.user_id
      AND sm.status = 'cadastrado'
      AND (
        coalesce(auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id', '') = ''
        OR sm.id::text = auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id'
      )
      AND (
        btrim(coalesce(r.motorista_id, '')) IN (sm.id::text, sm.portal_auth_user_id::text)
        OR EXISTS (
          SELECT 1
          FROM public.reserva_motoristas_extra e
          WHERE e.reserva_kind = 'transfer'
            AND e.reserva_id = r.id
            AND e.user_id = sm.user_id
            AND btrim(e.motorista_id) IN (sm.id::text, sm.portal_auth_user_id::text)
        )
      )
  )
  UNION ALL
  SELECT
    'grupo'::text,
    g.id,
    g.numero_reserva,
    g.status,
    g.motorista_id::text,
    NULL::text,
    g.perna_viagem,
    NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text,
    NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text,
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
    g.observacoes_viagem,
    false,
    false,
    NULL::text,
    '[]'::jsonb,
    g.user_id,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.solicitacoes_motoristas sm
        WHERE sm.portal_auth_user_id = (SELECT auth.uid())
          AND sm.user_id = g.user_id
          AND sm.status = 'cadastrado'
          AND btrim(coalesce(g.motorista_id::text, '')) IN (sm.id::text, sm.portal_auth_user_id::text)
          AND (
            coalesce(auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id', '') = ''
            OR sm.id::text = auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id'
          )
      ) THEN 'principal'
      ELSE 'extra'
    END
  FROM public.reservas_grupos g
  WHERE EXISTS (
    SELECT 1
    FROM public.solicitacoes_motoristas sm
    WHERE sm.portal_auth_user_id = (SELECT auth.uid())
      AND sm.user_id = g.user_id
      AND sm.status = 'cadastrado'
      AND (
        coalesce(auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id', '') = ''
        OR sm.id::text = auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id'
      )
      AND (
        btrim(coalesce(g.motorista_id::text, '')) IN (sm.id::text, sm.portal_auth_user_id::text)
        OR EXISTS (
          SELECT 1
          FROM public.reserva_motoristas_extra e
          WHERE e.reserva_kind = 'grupo'
            AND e.reserva_id = g.id
            AND e.user_id = sm.user_id
            AND btrim(e.motorista_id) IN (sm.id::text, sm.portal_auth_user_id::text)
        )
      )
  )
  ORDER BY numero_reserva DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_frota_motorista_reservas() FROM PUBLIC, anon;
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
  v_card text := coalesce(auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id', '');
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
          and (v_card = '' or sm.id::text = v_card)
          and (
            btrim(coalesce(r.motorista_id, '')) in (sm.id::text, sm.portal_auth_user_id::text)
            or exists (
              select 1 from public.reserva_motoristas_extra e
              where e.reserva_kind = 'transfer'
                and e.reserva_id = r.id
                and e.user_id = sm.user_id
                and btrim(e.motorista_id) in (sm.id::text, sm.portal_auth_user_id::text)
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
          and (v_card = '' or sm.id::text = v_card)
          and (
            btrim(coalesce(g.motorista_id::text, '')) in (sm.id::text, sm.portal_auth_user_id::text)
            or exists (
              select 1 from public.reserva_motoristas_extra e
              where e.reserva_kind = 'grupo'
                and e.reserva_id = g.id
                and e.user_id = sm.user_id
                and btrim(e.motorista_id) in (sm.id::text, sm.portal_auth_user_id::text)
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

REVOKE ALL ON FUNCTION public.frota_update_reserva_status(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.frota_update_reserva_status(text, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
