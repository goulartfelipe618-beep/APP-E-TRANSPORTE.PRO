
CREATE TABLE public.solicitacoes_servicos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tipo_servico text NOT NULL, -- 'website', 'email', 'google', 'dominio'
  status text NOT NULL DEFAULT 'pendente', -- 'pendente', 'em_andamento', 'concluido', 'recusado'
  dados_solicitacao jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- campos preenchidos pelo admin ao concluir
  link_acesso text DEFAULT NULL,
  data_expiracao date DEFAULT NULL,
  instrucoes_acesso text DEFAULT NULL,
  como_usar text DEFAULT NULL,
  observacoes_admin text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.solicitacoes_servicos ENABLE ROW LEVEL SECURITY;

-- Users can view own service requests
CREATE POLICY "Users can view own service requests"
ON public.solicitacoes_servicos FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can insert own service requests
CREATE POLICY "Users can insert own service requests"
ON public.solicitacoes_servicos FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admin master can view all service requests
CREATE POLICY "Admin master can view all service requests"
ON public.solicitacoes_servicos FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin_master'::app_role));

-- Admin master can update service requests
CREATE POLICY "Admin master can update service requests"
ON public.solicitacoes_servicos FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin_master'::app_role));

-- Admin master can delete service requests
CREATE POLICY "Admin master can delete service requests"
ON public.solicitacoes_servicos FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin_master'::app_role));
