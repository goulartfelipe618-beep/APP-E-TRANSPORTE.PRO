-- Confirma que o login atual é o motorista deste link exclusivo.
-- Não altera cadastros, reservas nem senhas.

CREATE OR REPLACE FUNCTION public.validar_entrada_portal_motorista(p_token text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_meta text := COALESCE((auth.jwt() -> 'user_metadata' ->> 'solicitacao_motorista_id'), '');
BEGIN
  IF v_uid IS NULL OR p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.solicitacoes_motoristas sm
    WHERE sm.portal_token = btrim(p_token)
      AND sm.portal_auth_user_id = v_uid
      AND sm.status = 'cadastrado'
      AND (v_meta = '' OR sm.id::text = v_meta)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validar_entrada_portal_motorista(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validar_entrada_portal_motorista(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.validar_entrada_portal_motorista(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
