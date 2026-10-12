-- Fecha execução pública das funções que trocam papel ou apagam dados.
-- Não apaga linhas, não altera papéis existentes e não muda a assinatura.
--
-- Estado anterior (2026-10-11):
-- replace_user_role(uuid, app_role): EXECUTE para anon, authenticated e service_role.
--   Corpo sem checar o chamador; só impedia rebaixar admin_master.
-- service_delete_user_owned_data(uuid): EXECUTE para anon, authenticated e service_role.
--   Corpo sem checar o chamador.
-- Chamadas legítimas: admin-users e webhook-solicitacao usam a service role.
-- O painel não chama nenhuma das duas com a chave anônima.
--
-- Reversão desta parte:
--   remover os dois IF de autorização e
--   GRANT EXECUTE ... TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.replace_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.role(), '') is distinct from 'service_role'
     and not public.is_admin_master(auth.uid()) then
    raise exception 'Acesso negado.'
      using errcode = '42501';
  end if;

  -- A service role continua podendo definir admin_transfer (webhook e painel).
  -- Conceder admin_master por esta função exige um admin_master autenticado.
  if _role = 'admin_master'::public.app_role
     and not public.is_admin_master(auth.uid()) then
    raise exception 'Só um administrador master autenticado pode conceder este papel.'
      using errcode = '42501';
  end if;

  if exists (
    select 1 from public.user_roles ur
    where ur.user_id = _user_id and ur.role = 'admin_master'
  ) and _role is distinct from 'admin_master'::public.app_role then
    raise exception 'Conta protegida: não é permitido redefinir o papel de administrador master a partir deste fluxo.'
      using errcode = 'check_violation';
  end if;

  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles (user_id, role) values (_user_id, _role);
end;
$function$;

REVOKE ALL ON FUNCTION public.replace_user_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_user_role(uuid, public.app_role) TO service_role;

CREATE OR REPLACE FUNCTION public.service_delete_user_owned_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'Acesso negado.'
      using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'p_user_id é obrigatório';
  end if;

  if exists (
    select 1
    from public.user_roles
    where user_id = p_user_id
      and role = 'admin_master'
  ) then
    raise exception 'Não é permitido eliminar dados de admin_master';
  end if;

  delete from public.webhook_testes where user_id = p_user_id;
  delete from public.mentoria_progresso where user_id = p_user_id;

  delete from public.community_post_comments where user_id = p_user_id;
  delete from public.community_post_likes where user_id = p_user_id;
  delete from public.community_post_mentions
  where mentioned_user_id = p_user_id
     or mentioned_by_user_id = p_user_id;
  delete from public.community_posts where author_user_id = p_user_id;

  delete from public.dominios_usuario where user_id = p_user_id;
  delete from public.comunicadores_evolution where user_id = p_user_id;

  delete from public.qr_codes where user_id = p_user_id;
  delete from public.tickets where user_id = p_user_id;
  delete from public.receptivos where user_id = p_user_id;
  delete from public.slides where user_id = p_user_id;

  delete from public.anotacoes where user_id = p_user_id;
  delete from public.automacoes where user_id = p_user_id;
  delete from public.campanha_leads where user_id = p_user_id;
  delete from public.campanhas where user_id = p_user_id;
  delete from public.cabecalho_contratual where user_id = p_user_id;
  delete from public.chamadas_taxi where user_id = p_user_id;
  delete from public.configuracoes where user_id = p_user_id;
  delete from public.contratos where user_id = p_user_id;
  delete from public.network where user_id = p_user_id;
  delete from public.reservas_grupos where user_id = p_user_id;
  delete from public.reservas_transfer where user_id = p_user_id;
  delete from public.solicitacoes_grupos where user_id = p_user_id;
  delete from public.solicitacoes_servicos where user_id = p_user_id;
  delete from public.solicitacoes_transfer where user_id = p_user_id;

  delete from public.solicitacoes_motoristas
  where user_id = p_user_id or lead_user_id = p_user_id;

  delete from public.user_plans where user_id = p_user_id;
  delete from public.user_roles where user_id = p_user_id;
end;
$function$;

REVOKE ALL ON FUNCTION public.service_delete_user_owned_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_delete_user_owned_data(uuid) TO service_role;

-- Funções já filtradas por sessão ou por admin_master. O painel chama com usuário logado.
-- Reversão: GRANT EXECUTE ... TO anon;

REVOKE ALL ON FUNCTION public.get_motorista_abrangencia_reservas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_motorista_abrangencia_reservas() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_list_veiculos_frota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_veiculos_frota() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_dominios_motoristas_for_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_dominios_motoristas_for_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.motoristas_for_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.motoristas_for_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.frota_update_reserva_status(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.frota_update_reserva_status(text, uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_session_primary_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_session_primary_role() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.metricas_kpis(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.metricas_kpis(integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.metricas_funil_conversao(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.metricas_funil_conversao(integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.metricas_evolucao_mensal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.metricas_evolucao_mensal() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.metricas_solicitacoes_por_canal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.metricas_solicitacoes_por_canal() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.metricas_top_destinos(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.metricas_top_destinos(integer, integer) TO authenticated, service_role;

-- Escrita direta em user_roles fica com a service role e com as políticas de admin_master
-- que já existiam. SELECT permanece para o painel ler o próprio papel.
-- Reversão: GRANT INSERT, UPDATE, DELETE ON TABLE public.user_roles TO anon, authenticated;

REVOKE ALL ON TABLE public.user_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_roles TO anon, authenticated;

-- RLS ligada e sem política: a API já não lia estas tabelas.
-- Nenhum arquivo do repositório as consulta. Reversão: GRANT ALL ... TO anon, authenticated;

REVOKE ALL ON TABLE public.pipeline_cards FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pipeline_colunas FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.pipeline_integracao FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.platform_products FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.platform_product_leads FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.renatlizador_keep FROM PUBLIC, anon, authenticated;

-- A view já filtra auth.uid() e está com security_invoker. Só tira escrita.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.r2_auto_backup_status FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.r2_auto_backup_status TO authenticated, service_role;

-- Bucket logos vazio no Storage. As logos atuais vão para a Cloudflare, no caminho {userId}/...
-- A política antiga deixava qualquer sessão autenticada alterar qualquer arquivo deste bucket.
-- Reversão: USING (bucket_id = 'logos') e WITH CHECK (bucket_id = 'logos'), sem a pasta.

DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;
CREATE POLICY "Authenticated users can delete logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
CREATE POLICY "Authenticated users can update logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
