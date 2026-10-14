-- Fecha os avisos do linter que não fazem parte do uso do painel.
-- Não abre tabela secreta, não torna bucket privado e não tira o rastreio público.

-- Pedido de acesso: o formulário público continua, mas a linha tem de ser um pedido pendente.
DROP POLICY IF EXISTS "Anyone can insert access requests" ON public.solicitacoes_acesso;
CREATE POLICY "Anyone can insert access requests"
  ON public.solicitacoes_acesso
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(btrim(nome_completo)) BETWEEN 2 AND 200
    AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    AND char_length(btrim(email)) <= 200
    AND char_length(regexp_replace(telefone, '\D', '', 'g')) BETWEEN 8 AND 15
    AND char_length(btrim(tipo_interesse)) BETWEEN 2 AND 40
    AND status = 'pendente'
    AND (cidade IS NULL OR char_length(cidade) <= 120)
    AND (estado IS NULL OR char_length(estado) <= 40)
    AND (mensagem IS NULL OR char_length(mensagem) <= 2000)
  );

-- Catálogo do motorista: visitante sem sessão não lê nem grava.
-- A regra antiga já não devolvia linha para anon (auth.uid() nulo).
DROP POLICY IF EXISTS catalogos_motorista_select_own ON public.catalogos_motorista;
CREATE POLICY catalogos_motorista_select_own
  ON public.catalogos_motorista
  FOR SELECT
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid()))
    OR (SELECT public.is_platform_staff())
  );

DROP POLICY IF EXISTS catalogos_motorista_insert_own ON public.catalogos_motorista;
CREATE POLICY catalogos_motorista_insert_own
  ON public.catalogos_motorista
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS catalogos_motorista_update_own ON public.catalogos_motorista;
CREATE POLICY catalogos_motorista_update_own
  ON public.catalogos_motorista
  FOR UPDATE
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid()))
    OR (SELECT public.is_platform_staff())
  )
  WITH CHECK (
    (user_id = (SELECT auth.uid()))
    OR (SELECT public.is_platform_staff())
  );

DROP POLICY IF EXISTS catalogos_motorista_delete_own ON public.catalogos_motorista;
CREATE POLICY catalogos_motorista_delete_own
  ON public.catalogos_motorista
  FOR DELETE
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid()))
    OR (SELECT public.is_platform_staff())
  );

-- Bucket público continua público. A política de SELECT só servia para listar todos os arquivos.
DROP POLICY IF EXISTS catalogo_motorista_storage_read ON storage.objects;
DROP POLICY IF EXISTS community_media_bucket_public_read ON storage.objects;
DROP POLICY IF EXISTS fullscreen_banners_public_read ON storage.objects;
DROP POLICY IF EXISTS login_assets_public_read ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
DROP POLICY IF EXISTS veiculos_imagens_public_read ON storage.objects;
DROP POLICY IF EXISTS website_briefing_public_read ON storage.objects;

-- Gatilhos e o evento de RLS: continuam disparando como dono da função.
-- Somem da API /rest/v1/rpc.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'admin_audit_staff_row',
        'ensure_r2_backup_off_for_new_transfer',
        'rastreios_antes_encerrar',
        'rastreios_apos_encerrar',
        'rastreios_somente_dono_mexe_posicao',
        'reservas_grupos_validate_cadastro_cliente',
        'reservas_transfer_validate_cadastro_cliente',
        'rls_auto_enable',
        'set_email_business_billing_on_solicitacao',
        'solicitacoes_motoristas_enforce_free_email',
        'tenant_row_force_user_id_ins',
        'trg_reserva_motoristas_extra_repasse_financeiro',
        'trg_reservas_grupos_financial',
        'trg_reservas_grupos_repasse_financeiro',
        'trg_reservas_transfer_financial',
        'trg_reservas_transfer_repasse_financeiro',
        'user_roles_protect_admin_master'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- Funções do painel e das políticas: visitante sem login não chama.
-- Quem está logado continua podendo, porque a tela e o RLS usam essas funções.
-- Rastreio público e o formulário de transporte ficam de fora desta lista.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'ensure_my_campaign_webhooks',
        'get_frota_motorista_branding',
        'gmail_minha_conta',
        'has_role',
        'is_admin_master',
        'is_community_member',
        'is_platform_staff',
        'log_user_activity',
        'log_user_activity_once',
        'merge_motorista_portal_foto_path',
        'motorista_telefone_disponivel_para_google',
        'motorista_tem_uazapi_atribuido'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
  END LOOP;
END $$;
