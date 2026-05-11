-- Eventos de login falhado (sem e-mail em claro): impressão digital SHA-256 do e-mail normalizado.
-- Auditoria de mutações staff em tabelas críticas (actor + recurso + ação).

CREATE TABLE IF NOT EXISTS public.auth_login_failure_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL DEFAULT 'failure' CHECK (outcome = 'failure'),
  email_fingerprint text NOT NULL,
  ip_prefix text,
  user_agent_short text
);

CREATE INDEX IF NOT EXISTS auth_login_failure_events_created_at_idx
  ON public.auth_login_failure_events (created_at DESC);

COMMENT ON TABLE public.auth_login_failure_events IS
  'Tentativas de login falhadas: SHA-256(hex) do e-mail em minúsculas; prefixo de IP; sem passwords.';

ALTER TABLE public.auth_login_failure_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_login_failure_events_select_master ON public.auth_login_failure_events;
CREATE POLICY auth_login_failure_events_select_master
  ON public.auth_login_failure_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin_master((SELECT auth.uid())));

-- Sem políticas INSERT para roles JWT: inserções via service_role (Edge) ignoram RLS.

GRANT SELECT ON TABLE public.auth_login_failure_events TO authenticated;


CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx ON public.admin_audit_log (actor_user_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_resource_idx ON public.admin_audit_log (resource_type, resource_id);

COMMENT ON TABLE public.admin_audit_log IS
  'Mutações administrativas (staff): actor, tabela, id; metadata sem PII por defeito.';

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_audit_log_select_staff ON public.admin_audit_log;
CREATE POLICY admin_audit_log_select_staff
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_staff()
    OR public.is_admin_master((SELECT auth.uid()))
  );

GRANT SELECT ON TABLE public.admin_audit_log TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_audit_staff_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rid text;
BEGIN
  IF uid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF NOT (public.is_platform_staff() OR public.is_admin_master(uid)) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'user_plans' THEN
      rid := OLD.user_id::text;
    ELSE
      rid := OLD.id::text;
    END IF;
  ELSE
    IF TG_TABLE_NAME = 'user_plans' THEN
      rid := NEW.user_id::text;
    ELSE
      rid := NEW.id::text;
    END IF;
  END IF;

  INSERT INTO public.admin_audit_log (actor_user_id, action, resource_type, resource_id, metadata)
  VALUES (
    uid,
    TG_OP,
    TG_TABLE_NAME,
    rid,
    jsonb_build_object('op', lower(TG_OP))
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.admin_audit_staff_row() IS
  'AFTER trigger: regista mutações quando o actor é staff; não falha a transação de negócio.';


DO $t$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_fullscreen_banners'
  ) THEN
    DROP TRIGGER IF EXISTS trg_admin_audit_admin_fullscreen_banners ON public.admin_fullscreen_banners;
    CREATE TRIGGER trg_admin_audit_admin_fullscreen_banners
      AFTER INSERT OR UPDATE OR DELETE ON public.admin_fullscreen_banners
      FOR EACH ROW
      EXECUTE FUNCTION public.admin_audit_staff_row();
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_plans'
  ) THEN
    DROP TRIGGER IF EXISTS trg_admin_audit_user_plans ON public.user_plans;
    CREATE TRIGGER trg_admin_audit_user_plans
      AFTER INSERT OR UPDATE OR DELETE ON public.user_plans
      FOR EACH ROW
      EXECUTE FUNCTION public.admin_audit_staff_row();
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'templates_website'
  ) THEN
    DROP TRIGGER IF EXISTS trg_admin_audit_templates_website ON public.templates_website;
    CREATE TRIGGER trg_admin_audit_templates_website
      AFTER INSERT OR UPDATE OR DELETE ON public.templates_website
      FOR EACH ROW
      EXECUTE FUNCTION public.admin_audit_staff_row();
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'solicitacoes_servicos'
  ) THEN
    DROP TRIGGER IF EXISTS trg_admin_audit_solicitacoes_servicos ON public.solicitacoes_servicos;
    CREATE TRIGGER trg_admin_audit_solicitacoes_servicos
      AFTER INSERT OR UPDATE OR DELETE ON public.solicitacoes_servicos
      FOR EACH ROW
      EXECUTE FUNCTION public.admin_audit_staff_row();
  END IF;
END;
$t$;

