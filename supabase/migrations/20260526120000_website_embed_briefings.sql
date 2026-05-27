-- Briefings de website via widget WordPress (sem utilizador autenticado).
-- Leitura pública de templates activos continua via Edge Function (service role).

ALTER TABLE public.solicitacoes_servicos
  ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN public.solicitacoes_servicos.user_id IS
  'Utilizador do painel; NULL quando origem wordpress_embed (widget público).';
