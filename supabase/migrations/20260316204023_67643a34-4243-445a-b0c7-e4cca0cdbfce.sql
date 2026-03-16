
CREATE TABLE public.mentoria_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'conteudo' CHECK (tipo IN ('sobre_sistema', 'conteudo')),
  titulo TEXT NOT NULL DEFAULT '',
  descricao TEXT DEFAULT '',
  imagem_url TEXT NOT NULL DEFAULT '',
  link_url TEXT DEFAULT NULL,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mentoria_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read active mentoria cards"
  ON public.mentoria_cards
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin master can manage mentoria cards"
  ON public.mentoria_cards
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin_master'))
  WITH CHECK (public.has_role(auth.uid(), 'admin_master'));
