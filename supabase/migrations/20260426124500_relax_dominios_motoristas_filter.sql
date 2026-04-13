-- Ajuste de visibilidade no painel master:
-- alguns motoristas podem carregar role operacional e estavam sendo ocultados.
-- Mantemos oculto apenas admin_master.
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
        and ur.role = 'admin_master'::public.app_role
    )
  order by d.created_at desc;
$$;

comment on function public.list_dominios_motoristas_for_admin() is
  'Painel master Domínios: lista domínios cadastrados por usuários, excluindo somente contas admin_master.';
