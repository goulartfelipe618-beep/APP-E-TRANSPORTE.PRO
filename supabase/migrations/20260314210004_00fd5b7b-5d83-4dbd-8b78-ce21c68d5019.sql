
CREATE TABLE public.solicitacoes_acesso (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo text NOT NULL,
  email text NOT NULL,
  telefone text NOT NULL,
  cidade text,
  estado text,
  mensagem text,
  tipo_interesse text NOT NULL DEFAULT 'conhecer',
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.solicitacoes_acesso ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a request (public form)
CREATE POLICY "Anyone can insert access requests"
ON public.solicitacoes_acesso
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admin master can view
CREATE POLICY "Admin master can view access requests"
ON public.solicitacoes_acesso
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin_master'::app_role));

-- Only admin master can update status
CREATE POLICY "Admin master can update access requests"
ON public.solicitacoes_acesso
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin_master'::app_role));

-- Only admin master can delete
CREATE POLICY "Admin master can delete access requests"
ON public.solicitacoes_acesso
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin_master'::app_role));
