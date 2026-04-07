-- Inclui limpeza de campanhas/leads no hard delete do utilizador.

create or replace function public.service_delete_user_owned_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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
$$;

revoke all on function public.service_delete_user_owned_data(uuid) from public;
grant execute on function public.service_delete_user_owned_data(uuid) to service_role;
