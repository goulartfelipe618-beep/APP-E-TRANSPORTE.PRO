
CREATE TABLE public.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('transfer', 'grupos')),
  modelo_contrato text NOT NULL DEFAULT '',
  politica_cancelamento text NOT NULL DEFAULT '',
  clausulas_adicionais text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tipo)
);

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contracts" ON public.contratos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contracts" ON public.contratos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contracts" ON public.contratos FOR UPDATE TO authenticated USING (auth.uid() = user_id);
