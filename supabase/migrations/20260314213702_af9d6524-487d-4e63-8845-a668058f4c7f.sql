
CREATE TABLE public.network (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nome_empresa text NOT NULL,
  categoria text NOT NULL DEFAULT '',
  cnpj text DEFAULT '',
  tipo_empresa text DEFAULT '',
  endereco text DEFAULT '',
  estado text DEFAULT '',
  cidade text DEFAULT '',
  website text DEFAULT '',
  nome_contato text DEFAULT '',
  cargo_funcao text DEFAULT '',
  telefone_direto text DEFAULT '',
  email_corporativo text DEFAULT '',
  status_contato text NOT NULL DEFAULT 'Prospect (Frio)',
  potencial_negocio text NOT NULL DEFAULT 'Médio',
  responsavel text DEFAULT '',
  observacoes text DEFAULT '',
  motorista_atribuido_id uuid DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.network ENABLE ROW LEVEL SECURITY;

-- Motoristas can only see their own networks
CREATE POLICY "Users can view own networks"
ON public.network FOR SELECT TO authenticated
USING (auth.uid() = user_id AND NOT has_role(auth.uid(), 'admin_master'::app_role));

-- Admin master can only see networks they created
CREATE POLICY "Admin master can view own networks"
ON public.network FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin_master'::app_role) AND auth.uid() = user_id);

-- Users can insert own networks
CREATE POLICY "Users can insert own networks"
ON public.network FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update own networks
CREATE POLICY "Users can update own networks"
ON public.network FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Users can delete own networks
CREATE POLICY "Users can delete own networks"
ON public.network FOR DELETE TO authenticated
USING (auth.uid() = user_id);
