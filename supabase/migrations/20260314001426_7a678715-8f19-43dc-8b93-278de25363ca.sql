
CREATE TABLE public.cabecalho_contratual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL DEFAULT 'Cabeçalho 1',
  razao_social text NOT NULL DEFAULT '',
  cnpj text NOT NULL DEFAULT '',
  endereco_sede text NOT NULL DEFAULT '',
  representante_legal text DEFAULT '',
  logo_contratual_url text DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  email_oficial text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.cabecalho_contratual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contract header"
  ON public.cabecalho_contratual FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contract header"
  ON public.cabecalho_contratual FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contract header"
  ON public.cabecalho_contratual FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
