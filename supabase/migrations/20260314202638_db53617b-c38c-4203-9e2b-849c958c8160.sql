
CREATE TABLE public.slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text NOT NULL DEFAULT '',
  subtitulo text NOT NULL DEFAULT '',
  imagem_url text NOT NULL DEFAULT '',
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own slides" ON public.slides FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own slides" ON public.slides FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own slides" ON public.slides FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own slides" ON public.slides FOR DELETE TO authenticated USING (auth.uid() = user_id);
