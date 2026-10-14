-- O passo anterior tirou o GRANT direto de anon.
-- Estas quatro ainda estavam abertas para PUBLIC, e o visitante entra por esse caminho.
-- Quem está logado e a service role continuam com EXECUTE explícito.

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'get_frota_motorista_branding',
        'has_role',
        'is_admin_master',
        'is_community_member'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;
