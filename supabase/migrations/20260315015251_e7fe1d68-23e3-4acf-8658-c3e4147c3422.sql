
CREATE TABLE public.chamadas_taxi (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nome_cliente text NOT NULL,
  telefone text NOT NULL,
  origem text,
  destino text,
  data_corrida date,
  hora_corrida time without time zone,
  qtd_passageiros integer DEFAULT 1,
  observacoes text,
  status text NOT NULL DEFAULT 'pendente',
  numero_atendimento integer GENERATED ALWAYS AS IDENTITY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chamadas_taxi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chamadas" ON public.chamadas_taxi
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chamadas" ON public.chamadas_taxi
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chamadas" ON public.chamadas_taxi
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chamadas" ON public.chamadas_taxi
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admin master can view all chamadas" ON public.chamadas_taxi
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin_master'::app_role));
