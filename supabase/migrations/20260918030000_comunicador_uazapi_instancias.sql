-- Instâncias UAZAPI cadastradas pelo admin master e atribuídas a um motorista.

CREATE TABLE IF NOT EXISTS public.comunicador_uazapi_instancias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotulo text NOT NULL DEFAULT 'Instância UAZAPI',
  api_url text NOT NULL,
  instance_token text NOT NULL,
  instance_name text,
  assigned_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS comunicador_uazapi_instancias_assigned_user_uidx
  ON public.comunicador_uazapi_instancias (assigned_user_id)
  WHERE assigned_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS comunicador_uazapi_instancias_token_uidx
  ON public.comunicador_uazapi_instancias (instance_token);

COMMENT ON TABLE public.comunicador_uazapi_instancias IS
  'Tokens UAZAPI (instância) cadastrados pelo admin e opcionalmente atribuídos a um motorista.';

ALTER TABLE public.comunicador_uazapi_instancias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uazapi_instancias_staff_all" ON public.comunicador_uazapi_instancias;
CREATE POLICY "uazapi_instancias_staff_all"
  ON public.comunicador_uazapi_instancias
  FOR ALL
  TO authenticated
  USING (public.is_platform_staff())
  WITH CHECK (public.is_platform_staff());

CREATE OR REPLACE FUNCTION public.motorista_tem_uazapi_atribuido()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.comunicador_uazapi_instancias i
    WHERE i.assigned_user_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.motorista_tem_uazapi_atribuido() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.motorista_tem_uazapi_atribuido() TO authenticated;
