-- Lista domínios de contas que não são painéis administrativos (motoristas / usuários comuns).
-- Apenas admin_master pode executar (retorna vazio se não for).
create or replace function public.list_dominios_motoristas_for_admin()
returns setof public.dominios_usuario
language sql
stable
security definer
set search_path = public
as $$
  select d.*
  from public.dominios_usuario d
  where public.is_admin_master(auth.uid())
    and not exists (
      select 1
      from public.user_roles ur
      where ur.user_id = d.user_id
        and ur.role in (
          'admin_master'::public.app_role,
          'admin_taxi'::public.app_role,
          'admin_transfer'::public.app_role
        )
    )
  order by d.created_at desc;
$$;

comment on function public.list_dominios_motoristas_for_admin() is
  'Painel master Domínios: lista domínios cadastrados por motoristas (exclui contas admin_transfer/admin_taxi/admin_master).';

revoke all on function public.list_dominios_motoristas_for_admin() from public;
grant execute on function public.list_dominios_motoristas_for_admin() to authenticated;
