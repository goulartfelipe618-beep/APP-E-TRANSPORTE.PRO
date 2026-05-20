-- Registo de atividades dos utilizadores admin_transfer (visível só ao admin_master).
-- Inserções feitas pelo próprio utilizador no painel Motorista Executivo.

CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  action_code text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_activity_log IS 'Linha do tempo de ações no painel transfer (admin_master lê; utilizador insere a própria linha).';

CREATE INDEX IF NOT EXISTS user_activity_log_user_created_idx
  ON public.user_activity_log (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS user_activity_log_once_per_user_action
  ON public.user_activity_log (user_id, action_code)
  WHERE action_code IN ('primeiro_acesso', 'config_iniciais_concluidas');

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_activity_log_select_admin_master" ON public.user_activity_log;
CREATE POLICY "user_activity_log_select_admin_master"
  ON public.user_activity_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin_master (auth.uid ()));

DROP POLICY IF EXISTS "user_activity_log_insert_own" ON public.user_activity_log;
CREATE POLICY "user_activity_log_insert_own"
  ON public.user_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid () = user_id);

GRANT SELECT, INSERT ON public.user_activity_log TO authenticated;
