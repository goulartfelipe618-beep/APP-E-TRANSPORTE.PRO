-- Remove integração Google Sheets (OAuth, status, cron). Não toca em reservas nem financeiro.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(j.jobid)
    FROM cron.job j
    WHERE j.jobname = 'google-sheets-backup-daily'
       OR j.command ILIKE '%google-sheets-backup-run%';
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_function THEN NULL;
END $$;

DROP FUNCTION IF EXISTS public.set_google_sheets_auto_sync(boolean);
DROP FUNCTION IF EXISTS public.cleanup_google_sheets_oauth_states();
DROP VIEW IF EXISTS public.google_sheets_backup_status;
DROP TABLE IF EXISTS public.google_sheets_oauth_states;
DROP TABLE IF EXISTS public.google_sheets_backup_connections;
