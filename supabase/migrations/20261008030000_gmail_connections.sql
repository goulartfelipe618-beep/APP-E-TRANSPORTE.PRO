-- Conta Gmail do operador (user_admin). O token fica só no servidor.

CREATE TABLE IF NOT EXISTS public.gmail_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gmail_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  return_to text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_oauth_states ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.gmail_connections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.gmail_oauth_states FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.gmail_connections TO service_role;
GRANT ALL ON public.gmail_oauth_states TO service_role;

CREATE OR REPLACE FUNCTION public.gmail_minha_conta()
RETURNS TABLE (email text, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.email, c.updated_at
  FROM public.gmail_connections c
  WHERE c.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.gmail_minha_conta() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gmail_minha_conta() TO authenticated, service_role;

COMMENT ON TABLE public.gmail_connections IS
  'Gmail ligado pelo operador. Tokens não são legíveis pelo browser.';
