-- Planos SaaS: free | standart | pro (coluna text; validação na app e Edge Functions).
-- Não altera dados existentes; apenas documenta o modelo na base.
comment on table public.user_plans is
  'Plano por utilizador: free (limites operacionais), standart (contratos e campanhas), pro (suite completa, mini painel motorista e marketing premium). Legados seed/grow/rise/apex mapeados a pro na aplicação.';
