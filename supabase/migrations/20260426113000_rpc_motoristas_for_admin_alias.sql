-- Compatibilidade retroativa:
-- alguns clientes ainda chamam /rpc/motoristas_for_admin (nome legado).
-- Mantemos este alias para evitar 404 e delegar à função atual.
create or replace function public.motoristas_for_admin()
returns setof public.dominios_usuario
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.list_dominios_motoristas_for_admin();
$$;

comment on function public.motoristas_for_admin() is
  'Alias legado para list_dominios_motoristas_for_admin() (compatibilidade de clientes antigos).';

revoke all on function public.motoristas_for_admin() from public;
grant execute on function public.motoristas_for_admin() to authenticated;
