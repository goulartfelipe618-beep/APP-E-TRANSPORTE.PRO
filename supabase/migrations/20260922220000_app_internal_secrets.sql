-- Segredos só para service_role (Edge Functions). Sem acesso anon/authenticated.

CREATE TABLE IF NOT EXISTS public.app_internal_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_internal_secrets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.app_internal_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.app_internal_secrets TO service_role;
