
-- Add missing columns to solicitacoes_transfer for volta and por_hora data
ALTER TABLE public.solicitacoes_transfer
  ADD COLUMN IF NOT EXISTS hora_viagem time without time zone,
  ADD COLUMN IF NOT EXISTS cupom text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS volta_embarque text,
  ADD COLUMN IF NOT EXISTS volta_desembarque text,
  ADD COLUMN IF NOT EXISTS volta_data date,
  ADD COLUMN IF NOT EXISTS volta_hora time without time zone,
  ADD COLUMN IF NOT EXISTS volta_passageiros integer,
  ADD COLUMN IF NOT EXISTS volta_mensagem text,
  ADD COLUMN IF NOT EXISTS volta_cupom text,
  ADD COLUMN IF NOT EXISTS por_hora_endereco_inicio text,
  ADD COLUMN IF NOT EXISTS por_hora_ponto_encerramento text,
  ADD COLUMN IF NOT EXISTS por_hora_data date,
  ADD COLUMN IF NOT EXISTS por_hora_hora time without time zone,
  ADD COLUMN IF NOT EXISTS por_hora_passageiros integer,
  ADD COLUMN IF NOT EXISTS por_hora_qtd_horas integer,
  ADD COLUMN IF NOT EXISTS por_hora_cupom text,
  ADD COLUMN IF NOT EXISTS por_hora_itinerario text;

-- Add missing columns to solicitacoes_grupos
ALTER TABLE public.solicitacoes_grupos
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS hora_ida time without time zone,
  ADD COLUMN IF NOT EXISTS data_retorno date,
  ADD COLUMN IF NOT EXISTS hora_retorno time without time zone,
  ADD COLUMN IF NOT EXISTS cupom text;
