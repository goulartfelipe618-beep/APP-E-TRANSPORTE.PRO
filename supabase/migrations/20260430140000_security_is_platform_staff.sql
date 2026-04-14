-- Função auxiliar para políticas RLS: administradores de plataforma (não só admin_master).
-- Documentação: Supabase — políticas para role admin / staff.

create or replace function public.is_platform_staff(check_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = check_uid
      and ur.role in ('admin_master', 'admin_taxi', 'admin_transfer')
  );
$$;

comment on function public.is_platform_staff(uuid) is
  'True se o utilizador tem papel administrativo (master, taxi ou transfer). Usar em políticas RLS.';

revoke all on function public.is_platform_staff(uuid) from public;
grant execute on function public.is_platform_staff(uuid) to authenticated;
grant execute on function public.is_platform_staff(uuid) to service_role;
