-- Fotos do mini portal do motorista (4 slots em dados_webhook) + isolamento Storage.

CREATE OR REPLACE FUNCTION public.merge_motorista_portal_foto_path(
  _slot integer,
  _path text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.solicitacoes_motoristas%ROWTYPE;
  v_key text;
  v_dw jsonb;
  v_prefix text;
BEGIN
  IF _slot IS NULL OR _slot < 1 OR _slot > 4 THEN
    RAISE EXCEPTION 'slot inválido (1 a 4)';
  END IF;

  SELECT * INTO v_row
  FROM public.solicitacoes_motoristas sm
  WHERE sm.portal_auth_user_id = (SELECT auth.uid())
    AND sm.status = 'cadastrado'
  ORDER BY sm.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cadastro de motorista não encontrado para esta sessão';
  END IF;

  v_key := 'portal_foto_' || _slot::text || '_path';
  v_prefix := v_row.user_id::text || '/' || v_row.id::text || '/portal-foto-' || _slot::text;

  IF _path IS NOT NULL AND btrim(_path) <> '' THEN
    IF NOT (btrim(_path) LIKE v_prefix || '%') THEN
      RAISE EXCEPTION 'path de storage inválido para este motorista';
    END IF;
  END IF;

  v_dw := COALESCE(v_row.dados_webhook, '{}'::jsonb);
  IF _path IS NULL OR btrim(_path) = '' THEN
    v_dw := v_dw - v_key;
  ELSE
    v_dw := jsonb_set(v_dw, ARRAY[v_key], to_jsonb(btrim(_path)), true);
  END IF;

  UPDATE public.solicitacoes_motoristas
  SET dados_webhook = v_dw,
      updated_at = now()
  WHERE id = v_row.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.merge_motorista_portal_foto_path(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_motorista_portal_foto_path(integer, text) TO authenticated;

-- Storage: motorista do portal acede apenas à pasta {dono}/{seu_cadastro_id}/...
DROP POLICY IF EXISTS "motorista_frota_docs_portal_self" ON storage.objects;
CREATE POLICY "motorista_frota_docs_portal_self"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'motorista-frota-docs'
    AND EXISTS (
      SELECT 1
      FROM public.solicitacoes_motoristas sm
      WHERE sm.id::text = split_part(name, '/', 2)
        AND sm.user_id::text = split_part(name, '/', 1)
        AND sm.portal_auth_user_id = (SELECT auth.uid())
        AND sm.status = 'cadastrado'
    )
  )
  WITH CHECK (
    bucket_id = 'motorista-frota-docs'
    AND EXISTS (
      SELECT 1
      FROM public.solicitacoes_motoristas sm
      WHERE sm.id::text = split_part(name, '/', 2)
        AND sm.user_id::text = split_part(name, '/', 1)
        AND sm.portal_auth_user_id = (SELECT auth.uid())
        AND sm.status = 'cadastrado'
    )
  );
