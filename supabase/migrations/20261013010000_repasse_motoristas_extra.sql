-- Repasse individual dos motoristas extras. Não apaga vínculos nem lançamentos já existentes.

ALTER TABLE public.reserva_motoristas_extra
  ADD COLUMN IF NOT EXISTS repasse_valor numeric(14,2);

ALTER TABLE public.reserva_motoristas_extra
  DROP CONSTRAINT IF EXISTS reserva_motoristas_extra_repasse_valor_check;

ALTER TABLE public.reserva_motoristas_extra
  ADD CONSTRAINT reserva_motoristas_extra_repasse_valor_check
  CHECK (repasse_valor IS NULL OR repasse_valor >= 0);

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS repasse_motorista_ref text;

CREATE UNIQUE INDEX IF NOT EXISTS financial_repasse_transfer_principal_uidx
  ON public.financial_transactions (reserva_transfer_id)
  WHERE origin = 'repasse_reserva_transfer' AND repasse_motorista_ref IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS financial_repasse_transfer_extra_uidx
  ON public.financial_transactions (reserva_transfer_id, repasse_motorista_ref)
  WHERE origin = 'repasse_reserva_transfer' AND repasse_motorista_ref IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS financial_repasse_grupo_principal_uidx
  ON public.financial_transactions (reserva_grupo_id)
  WHERE origin = 'repasse_reserva_grupo' AND repasse_motorista_ref IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS financial_repasse_grupo_extra_uidx
  ON public.financial_transactions (reserva_grupo_id, repasse_motorista_ref)
  WHERE origin = 'repasse_reserva_grupo' AND repasse_motorista_ref IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_repasse_motoristas_extra(p_kind text, p_reserva_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_kind = 'transfer' THEN
    INSERT INTO public.financial_transactions (
      user_id, kind, origin, payment_status, amount, occurred_on, description,
      reserva_transfer_id, category, is_primary, repasse_motorista_ref
    )
    SELECT
      t.user_id,
      'despesa',
      'repasse_reserva_transfer',
      'pending',
      e.repasse_valor,
      coalesce(
        (t.ida_data)::date,
        (t.por_hora_data)::date,
        (t.volta_data)::date,
        (t.created_at AT TIME ZONE 'America/Sao_Paulo')::date
      ),
      'Repasse motorista extra · ' || coalesce(nullif(btrim(sm.nome), ''), 'Motorista') || ' · Reserva #' || t.numero_reserva::text,
      t.id,
      'repasse_motorista',
      false,
      e.motorista_id
    FROM public.reserva_motoristas_extra e
    JOIN public.reservas_transfer t
      ON t.id = e.reserva_id
     AND t.user_id = e.user_id
    LEFT JOIN public.solicitacoes_motoristas sm
      ON sm.user_id = e.user_id
     AND sm.id::text = btrim(e.motorista_id)
    WHERE e.reserva_kind = 'transfer'
      AND e.reserva_id = p_reserva_id
      AND public._reserva_status_concluida(t.status)
      AND coalesce(e.repasse_valor, 0) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.financial_transactions f
        WHERE f.reserva_transfer_id = t.id
          AND f.origin = 'repasse_reserva_transfer'
          AND f.repasse_motorista_ref = e.motorista_id
      );
  ELSIF p_kind = 'grupo' THEN
    INSERT INTO public.financial_transactions (
      user_id, kind, origin, payment_status, amount, occurred_on, description,
      reserva_grupo_id, category, is_primary, repasse_motorista_ref
    )
    SELECT
      g.user_id,
      'despesa',
      'repasse_reserva_grupo',
      'pending',
      e.repasse_valor,
      coalesce(
        (g.data_ida)::date,
        (g.data_retorno)::date,
        (g.created_at AT TIME ZONE 'America/Sao_Paulo')::date
      ),
      'Repasse motorista extra · ' || coalesce(nullif(btrim(sm.nome), ''), 'Motorista') || ' · Grupo #' || g.numero_reserva::text,
      g.id,
      'repasse_motorista',
      false,
      e.motorista_id
    FROM public.reserva_motoristas_extra e
    JOIN public.reservas_grupos g
      ON g.id = e.reserva_id
     AND g.user_id = e.user_id
    LEFT JOIN public.solicitacoes_motoristas sm
      ON sm.user_id = e.user_id
     AND sm.id::text = btrim(e.motorista_id)
    WHERE e.reserva_kind = 'grupo'
      AND e.reserva_id = p_reserva_id
      AND public._reserva_status_concluida(g.status)
      AND coalesce(e.repasse_valor, 0) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.financial_transactions f
        WHERE f.reserva_grupo_id = g.id
          AND f.origin = 'repasse_reserva_grupo'
          AND f.repasse_motorista_ref = e.motorista_id
      );
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_repasse_motoristas_extra(text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_reservas_transfer_repasse_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_val numeric(14, 2);
begin
  if TG_OP <> 'UPDATE' then
    return NEW;
  end if;
  if not public._reserva_status_concluida(NEW.status) then
    return NEW;
  end if;

  v_val := coalesce(NEW.repasse_motorista, 0);
  perform set_config('app.financial_reserva_sync', 'on', true);

  if v_val > 0 and not exists (
    select 1 from public.financial_transactions f
    where f.reserva_transfer_id = NEW.id
      and f.origin = 'repasse_reserva_transfer'
      and f.repasse_motorista_ref is null
  ) then
    insert into public.financial_transactions (
      user_id, kind, origin, payment_status, amount, occurred_on, description,
      reserva_transfer_id, category, is_primary
    )
    values (
      NEW.user_id,
      'despesa',
      'repasse_reserva_transfer',
      'pending',
      v_val,
      coalesce(
        (NEW.ida_data)::date,
        (NEW.por_hora_data)::date,
        (NEW.volta_data)::date,
        (NEW.created_at at time zone 'America/Sao_Paulo')::date
      ),
      'Repasse motorista · Reserva #' || NEW.numero_reserva::text,
      NEW.id,
      'repasse_motorista',
      false
    );
  end if;

  perform public.sync_repasse_motoristas_extra('transfer', NEW.id);
  perform set_config('app.financial_reserva_sync', 'off', true);
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trg_reservas_grupos_repasse_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_val numeric(14, 2);
begin
  if TG_OP <> 'UPDATE' then
    return NEW;
  end if;
  if not public._reserva_status_concluida(NEW.status) then
    return NEW;
  end if;

  v_val := coalesce(NEW.repasse_motorista, 0);
  perform set_config('app.financial_reserva_sync', 'on', true);

  if v_val > 0 and not exists (
    select 1 from public.financial_transactions f
    where f.reserva_grupo_id = NEW.id
      and f.origin = 'repasse_reserva_grupo'
      and f.repasse_motorista_ref is null
  ) then
    insert into public.financial_transactions (
      user_id, kind, origin, payment_status, amount, occurred_on, description,
      reserva_grupo_id, category, is_primary
    )
    values (
      NEW.user_id,
      'despesa',
      'repasse_reserva_grupo',
      'pending',
      v_val,
      coalesce((NEW.data_ida)::date, (NEW.data_retorno)::date, (NEW.created_at at time zone 'America/Sao_Paulo')::date),
      'Repasse motorista · Grupo #' || NEW.numero_reserva::text,
      NEW.id,
      'repasse_motorista',
      false
    );
  end if;

  perform public.sync_repasse_motoristas_extra('grupo', NEW.id);
  perform set_config('app.financial_reserva_sync', 'off', true);
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trg_reserva_motoristas_extra_repasse_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  if coalesce(NEW.repasse_valor, 0) <= 0 then
    return NEW;
  end if;
  perform set_config('app.financial_reserva_sync', 'on', true);
  perform public.sync_repasse_motoristas_extra(NEW.reserva_kind, NEW.reserva_id);
  perform set_config('app.financial_reserva_sync', 'off', true);
  return NEW;
end;
$function$;

DROP TRIGGER IF EXISTS trg_reserva_motoristas_extra_repasse_financeiro ON public.reserva_motoristas_extra;
CREATE TRIGGER trg_reserva_motoristas_extra_repasse_financeiro
  AFTER INSERT OR UPDATE OF repasse_valor, motorista_id, reserva_id
  ON public.reserva_motoristas_extra
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_reserva_motoristas_extra_repasse_financeiro();

REVOKE ALL ON FUNCTION public.trg_reserva_motoristas_extra_repasse_financeiro() FROM PUBLIC, anon, authenticated;

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
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.solicitacoes_motoristas sm
        WHERE sm.portal_auth_user_id = (SELECT auth.uid())
          AND sm.user_id = r.user_id
          AND sm.status = 'cadastrado'
          AND btrim(coalesce(r.motorista_id, '')) IN (sm.id::text, sm.portal_auth_user_id::text)
          AND (
            coalesce(auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id', '') = ''
            OR sm.id::text = auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id'
          )
      ) THEN r.repasse_motorista
      ELSE (
        SELECT e.repasse_valor
        FROM public.reserva_motoristas_extra e
        JOIN public.solicitacoes_motoristas sm
          ON sm.portal_auth_user_id = (SELECT auth.uid())
         AND sm.user_id = e.user_id
         AND sm.status = 'cadastrado'
         AND btrim(e.motorista_id) IN (sm.id::text, sm.portal_auth_user_id::text)
         AND (
           coalesce(auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id', '') = ''
           OR sm.id::text = auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id'
         )
        WHERE e.reserva_kind = 'transfer'
          AND e.reserva_id = r.id
          AND e.user_id = r.user_id
        ORDER BY e.created_at DESC
        LIMIT 1
      )
    END,
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
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.solicitacoes_motoristas sm
        WHERE sm.portal_auth_user_id = (SELECT auth.uid())
          AND sm.user_id = g.user_id
          AND sm.status = 'cadastrado'
          AND btrim(coalesce(g.motorista_id::text, '')) IN (sm.id::text, sm.portal_auth_user_id::text)
          AND (
            coalesce(auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id', '') = ''
            OR sm.id::text = auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id'
          )
      ) THEN g.repasse_motorista
      ELSE (
        SELECT e.repasse_valor
        FROM public.reserva_motoristas_extra e
        JOIN public.solicitacoes_motoristas sm
          ON sm.portal_auth_user_id = (SELECT auth.uid())
         AND sm.user_id = e.user_id
         AND sm.status = 'cadastrado'
         AND btrim(e.motorista_id) IN (sm.id::text, sm.portal_auth_user_id::text)
         AND (
           coalesce(auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id', '') = ''
           OR sm.id::text = auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id'
         )
        WHERE e.reserva_kind = 'grupo'
          AND e.reserva_id = g.id
          AND e.user_id = g.user_id
        ORDER BY e.created_at DESC
        LIMIT 1
      )
    END,
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


NOTIFY pgrst, 'reload schema';
