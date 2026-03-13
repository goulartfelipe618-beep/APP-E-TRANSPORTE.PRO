
-- Reservas de Transfer
CREATE TABLE public.reservas_transfer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome_completo text NOT NULL,
  cpf_cnpj text NOT NULL,
  email text NOT NULL,
  telefone text NOT NULL,
  tipo_viagem text NOT NULL DEFAULT 'somente_ida',
  quem_viaja text NOT NULL DEFAULT 'motorista',
  -- Ida
  ida_embarque text,
  ida_desembarque text,
  ida_data date,
  ida_hora time,
  ida_passageiros integer,
  ida_cupom text,
  ida_mensagem text,
  -- Volta
  volta_embarque text,
  volta_desembarque text,
  volta_data date,
  volta_hora time,
  volta_passageiros integer,
  volta_cupom text,
  volta_mensagem text,
  -- Por Hora
  por_hora_endereco_inicio text,
  por_hora_ponto_encerramento text,
  por_hora_data date,
  por_hora_hora time,
  por_hora_passageiros integer,
  por_hora_qtd_horas integer,
  por_hora_cupom text,
  por_hora_itinerario text,
  -- Veículo/Motorista
  motorista_id text,
  veiculo_id text,
  -- Valores
  valor_base numeric NOT NULL DEFAULT 0,
  desconto numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  metodo_pagamento text,
  observacoes text,
  status text NOT NULL DEFAULT 'ativa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reservas_transfer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transfer reservations" ON public.reservas_transfer FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transfer reservations" ON public.reservas_transfer FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transfer reservations" ON public.reservas_transfer FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transfer reservations" ON public.reservas_transfer FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Reservas de Grupos
CREATE TABLE public.reservas_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome_completo text NOT NULL,
  cpf_cnpj text NOT NULL,
  email text NOT NULL,
  whatsapp text NOT NULL,
  tipo_veiculo text,
  num_passageiros integer,
  embarque text,
  destino text,
  data_ida date,
  hora_ida time,
  data_retorno date,
  hora_retorno time,
  cupom text,
  observacoes_viagem text,
  veiculo_id text,
  nome_motorista text,
  telefone_motorista text,
  valor_base numeric NOT NULL DEFAULT 0,
  desconto numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  metodo_pagamento text,
  status text NOT NULL DEFAULT 'ativa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reservas_grupos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own group reservations" ON public.reservas_grupos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own group reservations" ON public.reservas_grupos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own group reservations" ON public.reservas_grupos FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own group reservations" ON public.reservas_grupos FOR DELETE TO authenticated USING (auth.uid() = user_id);
