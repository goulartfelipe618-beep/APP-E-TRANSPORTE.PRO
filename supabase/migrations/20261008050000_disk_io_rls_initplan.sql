-- O disco enchia o orçamento porque auth.uid()/has_role() corriam em cada linha.
-- (select auth.uid()) e (select has_role(...)) passam a ser calculados uma vez por consulta.

CREATE OR REPLACE FUNCTION public._tmp_wrap_rls_expr(expr text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text := expr;
BEGIN
  IF s IS NULL OR btrim(s) = '' THEN
    RETURN s;
  END IF;

  s := replace(s, '( SELECT auth.uid() AS uid)', '___UID_ALIAS___');
  s := replace(s, '(select auth.uid())', '___UID_SEL___');
  s := replace(s, '(SELECT auth.uid())', '___UID_SEL___');
  s := replace(s, 'auth.uid()', '(select auth.uid())');
  s := replace(s, '___UID_ALIAS___', '( SELECT auth.uid() AS uid)');
  s := replace(s, '___UID_SEL___', '(select auth.uid())');

  s := replace(s, '(select auth.role())', '___ROLE_SEL___');
  s := replace(s, 'auth.role()', '(select auth.role())');
  s := replace(s, '___ROLE_SEL___', '(select auth.role())');

  s := replace(s, '(select auth.jwt())', '___JWT_SEL___');
  s := replace(s, 'auth.jwt()', '(select auth.jwt())');
  s := replace(s, '___JWT_SEL___', '(select auth.jwt())');

  s := regexp_replace(s, '(?<!\(select )is_platform_staff\(\)', '(select is_platform_staff())', 'g');
  s := regexp_replace(
    s,
    '(?<!\(select )has_role\(\(select auth\.uid\(\)\), ''([a-z_]+)''::app_role\)',
    '(select has_role((select auth.uid()), ''\1''::app_role))',
    'g'
  );
  RETURN s;
END;
$$;

DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
  role_list text;
  stmt text;
  changed int := 0;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    new_qual := public._tmp_wrap_rls_expr(r.qual);
    new_check := public._tmp_wrap_rls_expr(r.with_check);
    IF new_qual IS NOT DISTINCT FROM r.qual AND new_check IS NOT DISTINCT FROM r.with_check THEN
      CONTINUE;
    END IF;

    SELECT string_agg(quote_ident(role_name), ', ')
      INTO role_list
    FROM unnest(r.roles) AS role_name;

    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);

    stmt := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      r.policyname,
      r.schemaname,
      r.tablename,
      r.permissive,
      r.cmd,
      coalesce(role_list, 'public')
    );
    IF new_qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;
    EXECUTE stmt;
    changed := changed + 1;
  END LOOP;

  RAISE NOTICE 'políticas reescritas: %', changed;
END;
$$;

DROP FUNCTION public._tmp_wrap_rls_expr(text);

DROP INDEX IF EXISTS public.reservas_transfer_user_id_created_at_idx;
DROP INDEX IF EXISTS public.contratos_user_tipo_uidx;

ANALYZE public.reservas_transfer;
ANALYZE public.reservas_grupos;
ANALYZE public.user_roles;
ANALYZE public.financial_transactions;
