
-- Create empty_lags table
CREATE TABLE public.empty_lags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  origem TEXT NOT NULL DEFAULT '',
  destino TEXT NOT NULL DEFAULT '',
  data_hora TIMESTAMP WITH TIME ZONE,
  observacoes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendente',
  editado_por TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.empty_lags ENABLE ROW LEVEL SECURITY;

-- Admin master can do everything
CREATE POLICY "Admin master full access" ON public.empty_lags
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin_master'))
WITH CHECK (public.has_role(auth.uid(), 'admin_master'));

-- Anon can insert (webhook)
CREATE POLICY "Webhook can insert empty_lags" ON public.empty_lags
FOR INSERT TO anon
WITH CHECK (true);

-- Authenticated users can view approved only
CREATE POLICY "Users can view approved empty_lags" ON public.empty_lags
FOR SELECT TO authenticated
USING (status = 'aprovado' OR public.has_role(auth.uid(), 'admin_master'));
