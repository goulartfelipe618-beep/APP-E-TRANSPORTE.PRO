-- =============================================================================
-- E-TRANSPORTE.PRO — SQL para colar no Supabase → SQL Editor
-- Data de referência: 2026-06-23
--
-- INSTRUÇÕES:
-- 1. Abra o projeto Supabase correto (E-Transporte / Motorista Executivo).
-- 2. SQL Editor → New query → cole TODO este ficheiro → Run.
-- 3. Secções usam IF NOT EXISTS / DROP IF EXISTS quando possível (reexecução segura).
-- 4. Depois de correr o SQL, faça deploy da Edge Function atualizada:
--    supabase functions deploy motorista-frota-doc-link
--    (ou redeploy pelo painel Supabase → Edge Functions)
--
-- OUTRAS MIGRAÇÕES no repositório (aplique só se ainda NÃO estiverem na BD):
--   supabase/migrations/20260515185430_cabecalho_contratual_assinatura_url.sql
--   supabase/migrations/20260517120000_frota_reservas_rpc_perna_viagem.sql
--   supabase/migrations/20260520120000_user_activity_log.sql
--   supabase/migrations/20260526120000_website_embed_briefings.sql
--   supabase/migrations/20260601230000_frota_motorista_reservas_detalhes.sql
--   supabase/migrations/20260615120000_comunicadores_evolution_inbox_sessao.sql
--   supabase/migrations/20260616120000_comunicadores_evolution_rls_usuario.sql
-- =============================================================================


-- =============================================================================
-- BLOCO A — Reservas transfer: faturado + esconder valores (sessão anterior)
-- =============================================================================

ALTER TABLE public.reservas_transfer
  ADD COLUMN IF NOT EXISTS faturado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS esconder_valores boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.reservas_transfer.faturado IS
  'Serviço prestado com cobrança/faturamento em data posterior ao serviço.';
COMMENT ON COLUMN public.reservas_transfer.esconder_valores IS
  'Oculta valores cobrados ao cliente no mini portal do motorista e no PDF operacional.';

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
  observacoes text,
  faturado boolean,
  esconder_valores boolean
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
    CASE WHEN r.esconder_valores THEN NULL ELSE r.valor_base END AS valor_base,
    CASE WHEN r.esconder_valores THEN NULL ELSE r.desconto END AS desconto,
    CASE WHEN r.esconder_valores THEN NULL ELSE r.valor_total END AS valor_total,
    r.repasse_motorista,
    r.observacoes,
    r.faturado,
    r.esconder_valores
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
    g.observacoes_viagem AS observacoes,
    false AS faturado,
    false AS esconder_valores
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


-- =============================================================================
-- BLOCO B — Mini portal: 4 fotos do motorista + isolamento no Storage
-- =============================================================================

CREATE OR REPLACE FUNCTION public.merge_motorista_portal_foto_path(
  _slot integer,
  _path text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.solicitacoes_motoristas%ROWTYPE;
  v_key text;
  v_dw jsonb;
  v_prefix text;
BEGIN
  IF _slot IS NULL OR _slot < 1 OR _slot > 4 THEN
    RAISE EXCEPTION 'slot inválido (1 a 4)';
  END IF;

  SELECT * INTO v_row
  FROM public.solicitacoes_motoristas sm
  WHERE sm.portal_auth_user_id = (SELECT auth.uid())
    AND sm.status = 'cadastrado'
  ORDER BY sm.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cadastro de motorista não encontrado para esta sessão';
  END IF;

  v_key := 'portal_foto_' || _slot::text || '_path';
  v_prefix := v_row.user_id::text || '/' || v_row.id::text || '/portal-foto-' || _slot::text;

  IF _path IS NOT NULL AND btrim(_path) <> '' THEN
    IF NOT (btrim(_path) LIKE v_prefix || '%') THEN
      RAISE EXCEPTION 'path de storage inválido para este motorista';
    END IF;
  END IF;

  v_dw := COALESCE(v_row.dados_webhook, '{}'::jsonb);
  IF _path IS NULL OR btrim(_path) = '' THEN
    v_dw := v_dw - v_key;
  ELSE
    v_dw := jsonb_set(v_dw, ARRAY[v_key], to_jsonb(btrim(_path)), true);
  END IF;

  UPDATE public.solicitacoes_motoristas
  SET dados_webhook = v_dw,
      updated_at = now()
  WHERE id = v_row.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.merge_motorista_portal_foto_path(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_motorista_portal_foto_path(integer, text) TO authenticated;

-- Garantir bucket (ignora se já existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('motorista-frota-docs', 'motorista-frota-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Motorista do portal: só a pasta {dono_user_id}/{seu_cadastro_id}/...
DROP POLICY IF EXISTS "motorista_frota_docs_portal_self" ON storage.objects;
CREATE POLICY "motorista_frota_docs_portal_self"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'motorista-frota-docs'
    AND EXISTS (
      SELECT 1
      FROM public.solicitacoes_motoristas sm
      WHERE sm.id::text = split_part(name, '/', 2)
        AND sm.user_id::text = split_part(name, '/', 1)
        AND sm.portal_auth_user_id = (SELECT auth.uid())
        AND sm.status = 'cadastrado'
    )
  )
  WITH CHECK (
    bucket_id = 'motorista-frota-docs'
    AND EXISTS (
      SELECT 1
      FROM public.solicitacoes_motoristas sm
      WHERE sm.id::text = split_part(name, '/', 2)
        AND sm.user_id::text = split_part(name, '/', 1)
        AND sm.portal_auth_user_id = (SELECT auth.uid())
        AND sm.status = 'cadastrado'
    )
  );


-- =============================================================================
-- FIM — Verificação rápida (opcional)
-- =============================================================================
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'reservas_transfer'
--   AND column_name IN ('faturado', 'esconder_valores');
--
-- SELECT proname FROM pg_proc WHERE proname IN (
--   'get_frota_motorista_reservas',
--   'merge_motorista_portal_foto_path'
-- );
