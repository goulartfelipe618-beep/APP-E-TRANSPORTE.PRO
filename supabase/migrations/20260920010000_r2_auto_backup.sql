-- AUTO BACK-UP R2 por empresa. Só INSERT/UPDATE desta tabela; nunca apaga dados de negócio.

CREATE TABLE IF NOT EXISTS public.r2_auto_backup_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  last_run_date_sp text,
  last_status text,
  last_error text,
  last_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_prefix text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT r2_auto_backup_settings_status_chk
    CHECK (
      last_status IS NULL
      OR last_status IN ('ok', 'error', 'running', 'partial')
    )
);

CREATE INDEX IF NOT EXISTS r2_auto_backup_enabled_idx
  ON public.r2_auto_backup_settings (user_id)
  WHERE enabled = true;

ALTER TABLE public.r2_auto_backup_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.r2_auto_backup_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.r2_auto_backup_settings TO service_role;

DROP VIEW IF EXISTS public.r2_auto_backup_status;
CREATE VIEW public.r2_auto_backup_status
WITH (security_invoker = false) AS
SELECT
  s.user_id,
  s.enabled,
  s.last_run_at,
  s.last_run_date_sp,
  s.last_status,
  s.last_error,
  s.last_stats,
  s.last_prefix,
  s.created_at,
  s.updated_at
FROM public.r2_auto_backup_settings s
WHERE s.user_id = (SELECT auth.uid());

REVOKE ALL ON public.r2_auto_backup_status FROM PUBLIC, anon;
GRANT SELECT ON public.r2_auto_backup_status TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_r2_auto_backup(p_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin_transfer'
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  INSERT INTO public.r2_auto_backup_settings (user_id, enabled, updated_at)
  VALUES (auth.uid(), p_enabled, now())
  ON CONFLICT (user_id) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        updated_at = now();

  RETURN p_enabled;
END;
$$;

REVOKE ALL ON FUNCTION public.set_r2_auto_backup(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_r2_auto_backup(boolean) TO authenticated, service_role;
