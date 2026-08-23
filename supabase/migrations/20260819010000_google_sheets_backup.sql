-- Backup Google Sheets por empresa (admin_transfer).
-- Tokens só via service role / Edge Functions. O cliente lê apenas a view de status.

CREATE TABLE IF NOT EXISTS public.google_sheets_backup_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  google_email text,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  spreadsheet_id text NOT NULL,
  spreadsheet_url text,
  auto_sync_enabled boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  last_sync_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_sheets_backup_connections_status_chk
    CHECK (
      last_sync_status IS NULL
      OR last_sync_status IN ('ok', 'error', 'running', 'partial')
    )
);

CREATE TABLE IF NOT EXISTS public.google_sheets_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS google_sheets_oauth_states_created_idx
  ON public.google_sheets_oauth_states (created_at);

CREATE INDEX IF NOT EXISTS google_sheets_backup_auto_sync_idx
  ON public.google_sheets_backup_connections (user_id)
  WHERE auto_sync_enabled = true;

ALTER TABLE public.google_sheets_backup_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_sheets_oauth_states ENABLE ROW LEVEL SECURITY;

-- Sem políticas para authenticated/anon → acesso só service_role (bypass RLS).
REVOKE ALL ON public.google_sheets_backup_connections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.google_sheets_oauth_states FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.google_sheets_backup_connections TO service_role;
GRANT ALL ON public.google_sheets_oauth_states TO service_role;

DROP VIEW IF EXISTS public.google_sheets_backup_status;
CREATE VIEW public.google_sheets_backup_status
WITH (security_invoker = false) AS
SELECT
  c.user_id,
  c.google_email,
  c.spreadsheet_id,
  c.spreadsheet_url,
  c.auto_sync_enabled,
  c.last_sync_at,
  c.last_sync_status,
  c.last_sync_error,
  c.last_sync_stats,
  c.created_at,
  c.updated_at
FROM public.google_sheets_backup_connections c
WHERE c.user_id = (SELECT auth.uid());

REVOKE ALL ON public.google_sheets_backup_status FROM PUBLIC, anon;
GRANT SELECT ON public.google_sheets_backup_status TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_google_sheets_auto_sync(p_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.google_sheets_backup_connections
  SET
    auto_sync_enabled = coalesce(p_enabled, true),
    updated_at = now()
  WHERE user_id = auth.uid();

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.set_google_sheets_auto_sync(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_google_sheets_auto_sync(boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cleanup_google_sheets_oauth_states()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n int;
BEGIN
  DELETE FROM public.google_sheets_oauth_states
  WHERE created_at < now() - interval '30 minutes';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_google_sheets_oauth_states() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_google_sheets_oauth_states() TO service_role;

COMMENT ON TABLE public.google_sheets_backup_connections IS
  'OAuth Google Sheets por empresa; refresh/access tokens só via Edge Functions (service_role).';
COMMENT ON VIEW public.google_sheets_backup_status IS
  'Status público da ligação Google Sheets (sem tokens) para o dono autenticado.';

-- ---------------------------------------------------------------------------
-- Cron diário (activar quando for aplicar no projeto + secrets configurados).
-- Requer extensões pg_cron + pg_net e o secret GOOGLE_SHEETS_CRON_SECRET
-- igual ao header x-google-sheets-cron-secret na Edge Function.
--
-- Exemplo (descomentar / ajustar URL do project ref após deploy):
--
--   CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
--   CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
--
--   SELECT cron.schedule(
--     'google-sheets-backup-daily',
--     '15 6 * * *',  -- 06:15 UTC diário
--     $$
--     SELECT net.http_post(
--       url := 'https://lsfwmbpvithxqerfdlhy.supabase.co/functions/v1/google-sheets-backup-run',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'x-google-sheets-cron-secret', current_setting('app.settings.google_sheets_cron_secret', true)
--       ),
--       body := '{"mode":"cron"}'::jsonb
--     );
--     $$
--   );
--
-- Alternativa sem GUC: guardar o secret no Vault e referenciar no job.
-- Enquanto o cron não estiver activo, o botão «Backup agora» no painel cobre o fluxo.
-- ---------------------------------------------------------------------------
