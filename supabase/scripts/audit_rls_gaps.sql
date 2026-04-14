-- =============================================================================
-- Auditoria silenciosa de RLS (PostgreSQL / Supabase)
-- =============================================================================
-- Executar no SQL Editor do Supabase (ou psql) contra a base ATUAL.
-- Apenas leitura nas secções 1–3. A secção 4 devolve texto SQL para copiar
-- e rever manualmente antes de aplicar (não executa nada sozinha).
--
-- Pré-requisito: public.is_platform_staff(uuid)
-- (migração 20260430140000_security_is_platform_staff.sql).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tabelas em public SEM Row Level Security ativado
-- -----------------------------------------------------------------------------
SELECT
  c.relname AS table_name,
  'RLS_DISABLED'::text AS gap_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY 1;

-- -----------------------------------------------------------------------------
-- 2) Tabelas em public COM RLS ativado mas SEM qualquer política
-- -----------------------------------------------------------------------------
SELECT
  c.relname AS table_name,
  'RLS_ENABLED_NO_POLICIES'::text AS gap_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity
  AND NOT EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = c.relname
  )
ORDER BY 1;

-- -----------------------------------------------------------------------------
-- 3) União: todas as tabelas com lacuna (sem RLS ou RLS sem políticas)
-- -----------------------------------------------------------------------------
SELECT DISTINCT
  x.table_name,
  x.gap_type
FROM (
  SELECT c.relname AS table_name, 'RLS_DISABLED'::text AS gap_type
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  UNION ALL
  SELECT c.relname, 'RLS_ENABLED_NO_POLICIES'::text
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = c.relname
    )
) x
ORDER BY 1, 2;

-- -----------------------------------------------------------------------------
-- 4) DDL sugerido (coluna suggested_ddl) — REVISAR antes de executar
--
-- SELECT: public.is_platform_staff() OU (se existir user_id) linha própria.
-- AVISO: não cria políticas de INSERT/UPDATE/DELETE. Após ENABLE RLS,
-- confirme políticas de escrita para não bloquear a aplicação.
-- -----------------------------------------------------------------------------
WITH gaps AS (
  SELECT DISTINCT c.relname AS t
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND (
      NOT c.relrowsecurity
      OR (
        c.relrowsecurity
        AND NOT EXISTS (
          SELECT 1 FROM pg_policies p
          WHERE p.schemaname = 'public' AND p.tablename = c.relname
        )
      )
    )
),
cols AS (
  SELECT
    g.t,
    EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = g.t
        AND c.column_name = 'user_id'
    ) AS has_user_id
  FROM gaps g
)
SELECT
  format(
    $ddl$
-- === public.%I (has user_id: %s) ===
ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS %I ON public.%I;
CREATE POLICY %I
  ON public.%I
  FOR SELECT
  TO authenticated
  USING (%s);

$ddl$,
    t,
    cols.has_user_id::text,
    t,
    (t || '_rls_gap_select'),
    t,
    (t || '_rls_gap_select'),
    t,
    CASE
      WHEN cols.has_user_id THEN
        'public.is_platform_staff() OR (user_id IS NOT NULL AND auth.uid() = user_id)'
      ELSE
        'public.is_platform_staff()'
    END
  ) AS suggested_ddl
FROM cols
ORDER BY t;
