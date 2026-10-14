-- Cada conta autenticada só lê a própria linha do comunicador.
-- A linha oficial (escopo sistema) deixa de ser visível para todas as frotas.
-- A flag do menu do motorista continua disponível, sem telefone, QR ou token.

DROP POLICY IF EXISTS "comunicadores_evolution_select_sistema" ON public.comunicadores_evolution;
DROP POLICY IF EXISTS "comunicadores_evolution_select_tenant" ON public.comunicadores_evolution;

CREATE POLICY "comunicadores_evolution_select_tenant"
  ON public.comunicadores_evolution
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_platform_staff())
    OR (
      escopo = 'usuario'
      AND user_id IS NOT NULL
      AND (SELECT auth.uid()) = user_id
    )
  );

CREATE OR REPLACE FUNCTION public.painel_motorista_evolution_ativo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT c.painel_motorista_evolution_ativo
      FROM public.comunicadores_evolution AS c
      WHERE c.escopo = 'sistema'
      LIMIT 1
    ),
    true
  );
$$;

REVOKE ALL ON FUNCTION public.painel_motorista_evolution_ativo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.painel_motorista_evolution_ativo() TO authenticated, service_role;
