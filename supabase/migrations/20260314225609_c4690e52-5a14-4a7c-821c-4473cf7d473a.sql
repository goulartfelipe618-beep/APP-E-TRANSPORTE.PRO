
CREATE TABLE public.automacoes_campos_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  subcategoria text NOT NULL DEFAULT 'default',
  campos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(categoria, subcategoria)
);

ALTER TABLE public.automacoes_campos_config ENABLE ROW LEVEL SECURITY;

-- Admin master can do everything
CREATE POLICY "Admin master can manage campos config" ON public.automacoes_campos_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_master'))
  WITH CHECK (public.has_role(auth.uid(), 'admin_master'));

-- All authenticated can view
CREATE POLICY "Authenticated can view campos config" ON public.automacoes_campos_config
  FOR SELECT TO authenticated
  USING (true);

-- Seed with existing fields
INSERT INTO public.automacoes_campos_config (categoria, subcategoria, campos) VALUES
('transfer', 'somente_ida', '["Tipo de Viagem","Nome do Cliente","Telefone do Cliente","E-mail do Cliente","Origem / Como encontrou","Passageiros (Ida)","Embarque (Ida)","Destino (Ida)","Data (Ida)","Hora (Ida)","Mensagem (Ida)","Cupom (Ida)"]'),
('transfer', 'ida_volta', '["Tipo de Viagem","Nome do Cliente","Telefone do Cliente","E-mail do Cliente","Origem / Como encontrou","Passageiros (Ida)","Embarque (Ida)","Destino (Ida)","Data (Ida)","Hora (Ida)","Mensagem (Ida)","Cupom (Ida)","Passageiros (Volta)","Embarque (Volta)","Destino (Volta)","Data (Volta)","Hora (Volta)","Mensagem (Volta)","Cupom (Volta)"]'),
('transfer', 'por_hora', '["Tipo de Viagem","Nome do Cliente","Telefone do Cliente","E-mail do Cliente","Origem / Como encontrou","Passageiros","Endereço de Início","Data","Hora","Qtd. Horas","Ponto de Encerramento","Itinerário / Mensagem","Cupom"]'),
('grupo', 'default', '["Tipo de Veículo","Número de Passageiros","Endereço de Embarque","Destino","Data de Ida","Hora de Ida","Data de Retorno","Hora de Retorno","Observações","Cupom de Desconto","Nome do Cliente","E-mail do Cliente","WhatsApp do Cliente","Como nos encontrou"]'),
('motorista', 'default', '["Nome Completo","E-mail","Telefone / WhatsApp","CPF","Data de Nascimento","Endereço Completo","Cidade","Estado","Número da CNH","Categoria da CNH","Possui Veículo (sim/não)","Marca do Veículo","Modelo do Veículo","Ano do Veículo","Placa do Veículo","Experiência","Mensagem / Observações"]');
