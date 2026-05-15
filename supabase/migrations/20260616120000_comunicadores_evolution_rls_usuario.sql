-- Isolamento por utilizador: cada conta de frota só vê a sua linha `usuario` em comunicadores_evolution.
-- Linha `sistema`: leitura para utilizadores autenticados (flags do painel); escrita apenas staff.
-- Operações via service_role nas Edge Functions continuam a contornar RLS quando necessário.

ALTER TABLE public.comunicadores_evolution ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comunicadores_evolution_select_tenant" ON public.comunicadores_evolution;
CREATE POLICY "comunicadores_evolution_select_tenant"
  ON public.comunicadores_evolution
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_staff()
    OR escopo = 'sistema'
    OR (escopo = 'usuario' AND user_id IS NOT NULL AND auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "comunicadores_evolution_insert_usuario_own" ON public.comunicadores_evolution;
CREATE POLICY "comunicadores_evolution_insert_usuario_own"
  ON public.comunicadores_evolution
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_staff()
    OR (escopo = 'usuario' AND user_id IS NOT NULL AND auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "comunicadores_evolution_update_access" ON public.comunicadores_evolution;
CREATE POLICY "comunicadores_evolution_update_access"
  ON public.comunicadores_evolution
  FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_staff()
    OR (escopo = 'usuario' AND user_id IS NOT NULL AND auth.uid() = user_id)
  )
  WITH CHECK (
    public.is_platform_staff()
    OR (escopo = 'usuario' AND user_id IS NOT NULL AND auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "comunicadores_evolution_delete_access" ON public.comunicadores_evolution;
CREATE POLICY "comunicadores_evolution_delete_access"
  ON public.comunicadores_evolution
  FOR DELETE
  TO authenticated
  USING (
    public.is_platform_staff()
    OR (escopo = 'usuario' AND user_id IS NOT NULL AND auth.uid() = user_id)
  );
