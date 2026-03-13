
CREATE TABLE public.automacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('transfer', 'grupo', 'motorista')),
  ativo boolean NOT NULL DEFAULT false,
  mappings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own automations" ON public.automacoes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own automations" ON public.automacoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own automations" ON public.automacoes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own automations" ON public.automacoes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Also allow anon/public to SELECT automacoes for webhook lookups (edge function uses service role, but just in case)
CREATE POLICY "Service can read automations" ON public.automacoes FOR SELECT TO anon USING (true);
