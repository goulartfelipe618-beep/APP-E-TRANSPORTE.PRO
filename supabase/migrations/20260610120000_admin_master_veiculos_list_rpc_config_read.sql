-- =============================================================================
-- Admin Master: lista completa de veículos (frota de todos os utilizadores)
-- + leitura de configuracoes para etiquetas (nome) no painel admin.
-- Utilizadores comuns continuam com RLS em veiculos_frota (só user_id próprio).
-- =============================================================================

-- Leitura global de perfil para o Admin Master (somente SELECT; dono continua com políticas existentes).
alter table public.configuracoes enable row level security;

drop policy if exists configuracoes_admin_master_select on public.configuracoes;
create policy configuracoes_admin_master_select
  on public.configuracoes
  for select
  to authenticated
  using (public.is_admin_master((select auth.uid())));

comment on policy configuracoes_admin_master_select on public.configuracoes is
  'Admin Master pode ler qualquer linha (listagens operacionais). Isolamento dos restantes utilizadores mantém-se pelas outras políticas.';

-- Lista todas as linhas de frota; só executável por Admin Master (validação explícita).
create or replace function public.admin_list_veiculos_frota()
returns setof public.veiculos_frota
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin_master((select auth.uid())) then
    raise exception 'Acesso negado'
      using errcode = '42501';
  end if;

  return query
    select v.*
    from public.veiculos_frota v
    order by v.created_at desc nulls last;
end;
$$;

comment on function public.admin_list_veiculos_frota() is
  'Painel Admin Master: devolve todos os veículos cadastrados. Bloqueado para não-master.';

revoke all on function public.admin_list_veiculos_frota() from public;
grant execute on function public.admin_list_veiculos_frota() to authenticated;
