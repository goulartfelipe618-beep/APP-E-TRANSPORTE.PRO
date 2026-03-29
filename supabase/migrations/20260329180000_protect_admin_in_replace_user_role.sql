-- Impede que replace_user_role rebaixe administradores (ex.: e-mail do master usado num lead da landing).
create or replace function public.replace_user_role(_user_id uuid, _role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.user_roles ur
    where ur.user_id = _user_id and ur.role = 'admin_master'
  ) and _role is distinct from 'admin_master'::public.app_role then
    raise exception 'Conta protegida: não é permitido redefinir o papel de administrador master a partir deste fluxo.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.user_roles ur
    where ur.user_id = _user_id and ur.role = 'admin_taxi'
  ) and _role is distinct from 'admin_taxi'::public.app_role then
    raise exception 'Conta protegida: não é permitido redefinir o papel de administrador taxi via este fluxo.'
      using errcode = 'check_violation';
  end if;

  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles (user_id, role) values (_user_id, _role);
end;
$$;

comment on function public.replace_user_role(uuid, public.app_role) is
  'Substitui o papel do usuário por um único registro; não rebaixa admin_master nem admin_taxi.';

revoke all on function public.replace_user_role(uuid, public.app_role) from public;
grant execute on function public.replace_user_role(uuid, public.app_role) to service_role;
