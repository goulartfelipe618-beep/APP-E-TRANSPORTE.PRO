
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'melhoria',
  assunto text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'aberto',
  resposta_admin text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own tickets" ON public.tickets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own tickets" ON public.tickets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own tickets" ON public.tickets
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tickets" ON public.tickets
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin master can view all tickets" ON public.tickets
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin_master'::app_role));

CREATE POLICY "Admin master can update all tickets" ON public.tickets
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin_master'::app_role));

CREATE POLICY "Admin master can delete all tickets" ON public.tickets
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin_master'::app_role));
