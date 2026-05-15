-- =============================================================================
-- Complemento RLS: INSERT / UPDATE / DELETE apenas para o dono (user_id)
-- =============================================================================
-- Objetivo: tabelas com coluna user_id (uuid) que já têm RLS mas ficaram só
-- com SELECT (ex.: fecho de lacunas 20260430210000) passam a permitir escrita
-- pelo próprio utilizador autenticado — sem OR com staff (evita forjar tenant).
--
-- Regras:
--   * Só actua se NÃO existir já qualquer política INSERT (ou ALL) na tabela;
--     idem para UPDATE e DELETE.
--   * Exclui tabelas com regras de negócio multi-parte, portal motorista, rede,
--     comunidade, financeiro, papéis, webhooks, logs, etc.
--
-- Após aplicar: correr supabase/scripts/audit_rls_gaps.sql e testar fluxos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Força user_id = auth.uid() em INSERT quando há sessão (browser não pode
-- escolher outro tenant). Com service_role / sem JWT, mantém NEW.user_id.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tenant_row_force_user_id_ins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.tenant_row_force_user_id_ins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_row_force_user_id_ins() TO authenticated, service_role;

COMMENT ON FUNCTION public.tenant_row_force_user_id_ins() IS
  'BEFORE INSERT: com sessão JWT, força user_id = auth.uid() (anti-tenant-spoofing).';

DO $body$
DECLARE
  r record;
  n_ins int;
  n_upd int;
  n_del int;
  skip_tables text[] := ARRAY[
    'user_plans',
    'user_roles',
    'financial_transactions',
    'auth_login_failure_events',
    'admin_audit_log',
    'mp_webhook_events',
    'login_painel_config',
    'painel_client_error_logs',
    'admin_avisos_plataforma',
    'admin_fullscreen_banners',
    'planos_contrato_config',
    'automacoes_campos_config',
    'cadastro_clientes',
    'clientes',
    'veiculos_frota',
    'motoristas',
    'templates_website',
    'solicitacoes_motoristas',
    'network',
    'network_follows',
    'network_blocks',
    'network_mutes',
    'network_reports'
  ];
BEGIN
  FOR r IN
    SELECT c.relname AS tname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname <> ALL (skip_tables)
      AND c.relname NOT LIKE 'community\_%' ESCAPE '\'
      AND c.relname NOT LIKE 'network\_%' ESCAPE '\'
      AND c.relname NOT LIKE 'solicitacoes\_%' ESCAPE '\'
      AND c.relname NOT LIKE 'reservas\_%' ESCAPE '\'
      AND c.relname NOT LIKE 'rastreios\_%' ESCAPE '\'
      AND c.relname NOT LIKE 'motorista\_%' ESCAPE '\'
      AND c.relname NOT LIKE 'mentoria\_%' ESCAPE '\'
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns col
      WHERE col.table_schema = 'public'
        AND col.table_name = r.tname
        AND col.column_name = 'user_id'
        AND col.data_type = 'uuid'
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tname);

    SELECT count(*)::int
      INTO n_ins
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = r.tname
      AND (p.cmd = 'INSERT' OR p.cmd = 'ALL');

    IF n_ins = 0 THEN
      EXECUTE format(
        $f$
        DROP POLICY IF EXISTS "etp_gapfill_owner_insert" ON public.%I;
        CREATE POLICY "etp_gapfill_owner_insert" ON public.%I
        FOR INSERT TO authenticated
        WITH CHECK (user_id = (SELECT auth.uid()));
        $f$,
        r.tname,
        r.tname
      );
    END IF;

    SELECT count(*)::int
      INTO n_upd
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = r.tname
      AND (p.cmd = 'UPDATE' OR p.cmd = 'ALL');

    IF n_upd = 0 THEN
      EXECUTE format(
        $f$
        DROP POLICY IF EXISTS "etp_gapfill_owner_update" ON public.%I;
        CREATE POLICY "etp_gapfill_owner_update" ON public.%I
        FOR UPDATE TO authenticated
        USING (user_id = (SELECT auth.uid()))
        WITH CHECK (user_id = (SELECT auth.uid()));
        $f$,
        r.tname,
        r.tname
      );
    END IF;

    SELECT count(*)::int
      INTO n_del
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = r.tname
      AND (p.cmd = 'DELETE' OR p.cmd = 'ALL');

    IF n_del = 0 THEN
      EXECUTE format(
        $f$
        DROP POLICY IF EXISTS "etp_gapfill_owner_delete" ON public.%I;
        CREATE POLICY "etp_gapfill_owner_delete" ON public.%I
        FOR DELETE TO authenticated
        USING (user_id = (SELECT auth.uid()));
        $f$,
        r.tname,
        r.tname
      );
    END IF;
  END LOOP;
END
$body$;

-- Triggers BEFORE INSERT nas mesmas famílias de tabelas (nome único por tabela).
DO $tr$
DECLARE
  r record;
  trg_name text;
  skip_tables text[] := ARRAY[
    'user_plans',
    'user_roles',
    'financial_transactions',
    'auth_login_failure_events',
    'admin_audit_log',
    'mp_webhook_events',
    'login_painel_config',
    'painel_client_error_logs',
    'admin_avisos_plataforma',
    'admin_fullscreen_banners',
    'planos_contrato_config',
    'automacoes_campos_config',
    'cadastro_clientes',
    'clientes',
    'veiculos_frota',
    'motoristas',
    'templates_website',
    'solicitacoes_motoristas',
    'network',
    'network_follows',
    'network_blocks',
    'network_mutes',
    'network_reports'
  ];
BEGIN
  FOR r IN
    SELECT c.relname AS tname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname <> ALL (skip_tables)
      AND c.relname NOT LIKE 'community\_%' ESCAPE '\'
      AND c.relname NOT LIKE 'network\_%' ESCAPE '\'
      AND c.relname NOT LIKE 'solicitacoes\_%' ESCAPE '\'
      AND c.relname NOT LIKE 'reservas\_%' ESCAPE '\'
      AND c.relname NOT LIKE 'rastreios\_%' ESCAPE '\'
      AND c.relname NOT LIKE 'motorista\_%' ESCAPE '\'
      AND c.relname NOT LIKE 'mentoria\_%' ESCAPE '\'
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns col
      WHERE col.table_schema = 'public'
        AND col.table_name = r.tname
        AND col.column_name = 'user_id'
        AND col.data_type = 'uuid'
    ) THEN
      CONTINUE;
    END IF;

    trg_name := 'trg_etp_force_uid_' || regexp_replace(r.tname, '[^a-zA-Z0-9_]', '_', 'g');
    IF length(trg_name) > 60 THEN
      trg_name := left(trg_name, 60);
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trg_name, r.tname);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tenant_row_force_user_id_ins()',
      trg_name,
      r.tname
    );
  END LOOP;
END
$tr$;
