
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS cidade text DEFAULT '',
  ADD COLUMN IF NOT EXISTS estado text DEFAULT '',
  ADD COLUMN IF NOT EXISTS endereco_completo text DEFAULT '',
  ADD COLUMN IF NOT EXISTS nome_empresa text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cnpj text DEFAULT '';
