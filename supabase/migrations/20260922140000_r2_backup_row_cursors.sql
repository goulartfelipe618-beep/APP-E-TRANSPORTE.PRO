-- Cursores por tabela: o AUTO BACK-UP só reenvia linhas novas/alteradas.

ALTER TABLE public.r2_auto_backup_settings
  ADD COLUMN IF NOT EXISTS last_row_cursors jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.r2_auto_backup_settings
SET last_row_cursors = jsonb_build_object(
  'solicitacoes_transfer', last_run_at,
  'reservas_transfer', last_run_at,
  'solicitacoes_grupos', last_run_at,
  'reservas_grupos', last_run_at,
  'solicitacoes_motoristas_cad', last_run_at,
  'solicitacoes_motoristas_sol', last_run_at,
  'cadastro_clientes', last_run_at,
  'veiculos_frota', last_run_at,
  'anotacoes', last_run_at
)
WHERE last_run_at IS NOT NULL
  AND (last_row_cursors IS NULL OR last_row_cursors = '{}'::jsonb);
