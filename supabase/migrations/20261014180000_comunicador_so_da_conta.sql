-- A linha de WhatsApp de uma conta só pode ser lida por essa conta.
-- O administrador master continua a ver apenas a linha oficial (escopo sistema).

DROP POLICY IF EXISTS "comunicadores_evolution_select_tenant" ON public.comunicadores_evolution;

CREATE POLICY "comunicadores_evolution_select_tenant"
  ON public.comunicadores_evolution
  FOR SELECT
  TO authenticated
  USING (
    escopo = 'usuario'
    AND user_id IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  );
