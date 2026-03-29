-- Papel efetivo da sessão (ignora RLS em user_roles no cliente).
create or replace function public.get_session_primary_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select ur.role
  from public.user_roles ur
  where ur.user_id = auth.uid()
  order by case ur.role
    when 'admin_master' then 1
    when 'admin_taxi' then 2
    when 'admin_transfer' then 3
    else 4
  end
  limit 1;
$$;

comment on function public.get_session_primary_role() is
  'Papel da conta logada com prioridade admin_master > admin_taxi > admin_transfer. Usado no login/rotas.';

revoke all on function public.get_session_primary_role() from public;
grant execute on function public.get_session_primary_role() to authenticated;

-- Um papel por utilizador (remove duplicados mantendo o de maior prioridade).
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by case role
        when 'admin_master' then 1
        when 'admin_taxi' then 2
        when 'admin_transfer' then 3
        else 4
      end,
      id
    ) as rn
  from public.user_roles
)
delete from public.user_roles ur
using ranked r
where ur.id = r.id and r.rn > 1;

-- Garantir novamente admin master (idempotente).
do $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower('goulartfelipe618@gmail.com');
  if uid is null then
    raise notice 'restore_admin_master: utilizador não encontrado em auth.users';
    return;
  end if;

  delete from public.user_roles where user_id = uid;
  insert into public.user_roles (user_id, role) values (uid, 'admin_master');
  delete from public.user_plans where user_id = uid;
end $$;
