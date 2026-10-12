-- A view ficou com MAINTAIN para authenticated depois de revogar INSERT/UPDATE/DELETE.
-- Reversão: GRANT MAINTAIN ON TABLE public.r2_auto_backup_status TO authenticated;

REVOKE MAINTAIN ON TABLE public.r2_auto_backup_status FROM PUBLIC, anon, authenticated;
