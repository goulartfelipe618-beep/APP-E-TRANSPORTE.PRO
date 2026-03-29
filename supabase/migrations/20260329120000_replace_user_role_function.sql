-- Troca atômica de papel por usuário (evita upsert com onConflict incorreto e linhas duplicadas).
create or replace function public.replace_user_role(_user_id uuid, _role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles (user_id, role) values (_user_id, _role);
end;
$$;

comment on function public.replace_user_role(uuid, public.app_role) is
  'Remove papéis existentes do usuário e insere um único papel. Usado pelo webhook de motorista e finalize_landing_lead.';

revoke all on function public.replace_user_role(uuid, public.app_role) from public;
grant execute on function public.replace_user_role(uuid, public.app_role) to service_role;
