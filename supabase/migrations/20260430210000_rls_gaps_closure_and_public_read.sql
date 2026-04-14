-- =============================================================================
-- Fecho de lacunas RLS (alinhado a supabase/scripts/audit_rls_gaps.sql)
-- =============================================================================
-- Aplica na base atual:
--   A) Para cada tabela public em "gap" (sem RLS OU RLS sem políticas),
--      exceto lista de exclusão: ENABLE RLS + política SELECT para
--      authenticated usando is_platform_staff() ou user_id.
--   B) Políticas explícitas para leitura por utilizadores não autenticados
--      onde a app depende disso (login / avisos).
--
-- Pré-requisito: public.is_platform_staff(uuid)
-- (20260430140000_security_is_platform_staff.sql).
--
-- Não substitui políticas INSERT/UPDATE/DELETE existentes. Se uma tabela
-- ficar sem políticas de escrita após o primeiro SELECT, acrescente-as noutra
-- migração (o script de auditoria avisa o mesmo).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) Lacunas dinâmicas (mesma lógica do audit_rls_gaps.sql secção 4)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  has_uid boolean;
  pol_name text;
BEGIN
  FOR r IN
    SELECT DISTINCT c.relname AS t
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      -- Não alterar tabelas com políticas públicas tratadas em (B) ou singletons sensíveis:
      AND c.relname NOT IN (
        'login_painel_config'
      )
      AND (
        NOT c.relrowsecurity
        OR (
          c.relrowsecurity
          AND NOT EXISTS (
            SELECT 1
            FROM pg_policies p
            WHERE p.schemaname = 'public'
              AND p.tablename = c.relname
          )
        )
      )
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns col
      WHERE col.table_schema = 'public'
        AND col.table_name = r.t
        AND col.column_name = 'user_id'
    )
    INTO has_uid;

    pol_name := r.t || '_rls_gap_select_v2';

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.t || '_rls_gap_select', r.t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_name, r.t);

    IF has_uid THEN
      EXECUTE format(
        $p$
        CREATE POLICY %I ON public.%I
        FOR SELECT TO authenticated
        USING (
          public.is_platform_staff()
          OR (user_id IS NOT NULL AND auth.uid() = user_id)
        )
        $p$,
        pol_name,
        r.t
      );
    ELSE
      EXECUTE format(
        $p$
        CREATE POLICY %I ON public.%I
        FOR SELECT TO authenticated
        USING (public.is_platform_staff())
        $p$,
        pol_name,
        r.t
      );
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- B1) Login: leitura da config da tela (anon + authenticated) — idempotente
-- -----------------------------------------------------------------------------
ALTER TABLE public.login_painel_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS login_painel_config_public_read ON public.login_painel_config;

CREATE POLICY login_painel_config_public_read
  ON public.login_painel_config
  FOR SELECT
  TO anon, authenticated
  USING (id = 1);

GRANT SELECT ON public.login_painel_config TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- B2) Avisos na página de login (anon) — linhas ativas com incluir_login
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS admin_avisos_plataforma_select_anon_login ON public.admin_avisos_plataforma;

CREATE POLICY admin_avisos_plataforma_select_anon_login
  ON public.admin_avisos_plataforma
  FOR SELECT
  TO anon
  USING (
    ativo = true
    AND COALESCE(incluir_login, false) = true
  );

GRANT SELECT ON public.admin_avisos_plataforma TO anon;
