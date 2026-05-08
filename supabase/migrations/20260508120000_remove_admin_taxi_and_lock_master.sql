-- ============================================================================
-- Remove o tipo de login admin_taxi do projeto e blinda o admin_master.
-- ----------------------------------------------------------------------------
-- Esta plataforma só permite duas roles: admin_master (única) e admin_transfer.
-- Migration idempotente: pode ser reaplicada sem efeitos colaterais.
--
-- Estratégia: o enum public.app_role é mantido para não quebrar dezenas de
-- políticas RLS que referenciam user_roles.role; o valor 'admin_taxi' fica
-- proibido por CHECK constraint na tabela e pelo trigger que protege a única
-- linha admin_master.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Limpa registos de user_roles ainda na role admin_taxi.
-- ---------------------------------------------------------------------------
delete from public.user_roles where role::text = 'admin_taxi';

-- ---------------------------------------------------------------------------
-- 2) CHECK constraint que proíbe admin_taxi (e qualquer outro valor futuro
--    fora do par master/transfer) em user_roles.
-- ---------------------------------------------------------------------------
alter table public.user_roles
  drop constraint if exists user_roles_role_no_admin_taxi_chk;

alter table public.user_roles
  add constraint user_roles_role_no_admin_taxi_chk
  check (role in ('admin_master'::public.app_role, 'admin_transfer'::public.app_role));

comment on constraint user_roles_role_no_admin_taxi_chk on public.user_roles is
  'Plataforma só admite admin_master e admin_transfer. admin_taxi foi descontinuado.';

-- ---------------------------------------------------------------------------
-- 3) Atualiza funções utilitárias para refletir o novo conjunto de roles.
-- ---------------------------------------------------------------------------

-- is_community_member: comunidade só tem master e transfer.
create or replace function public.is_community_member(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role in ('admin_master', 'admin_transfer')
  );
$$;

-- is_platform_staff: idem.
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
      and ur.role in ('admin_master', 'admin_transfer')
  );
$$;

comment on function public.is_platform_staff(uuid) is
  'True se o utilizador tem papel administrativo (admin_master ou admin_transfer). Usar em políticas RLS.';

revoke all on function public.is_platform_staff(uuid) from public;
grant execute on function public.is_platform_staff(uuid) to authenticated;
grant execute on function public.is_platform_staff(uuid) to service_role;

-- replace_user_role: blinda admin_master (já era idempotente; agora sem admin_taxi).
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

  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles (user_id, role) values (_user_id, _role);
end;
$$;

comment on function public.replace_user_role(uuid, public.app_role) is
  'Substitui o papel do usuário por um único registro; protege admin_master.';

revoke all on function public.replace_user_role(uuid, public.app_role) from public;
grant execute on function public.replace_user_role(uuid, public.app_role) to service_role;

-- get_session_primary_role: prioridade admin_master > admin_transfer.
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
    when 'admin_transfer' then 2
    else 3
  end
  limit 1;
$$;

comment on function public.get_session_primary_role() is
  'Papel da conta logada com prioridade admin_master > admin_transfer. Usado no login/rotas.';

revoke all on function public.get_session_primary_role() from public;
grant execute on function public.get_session_primary_role() to authenticated;

-- list_dominios_motoristas_for_admin: já só excluía admin_master desde 20260426.
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
  'Painel master Domínios: lista domínios cadastrados por usuários, excluindo apenas contas admin_master.';

revoke all on function public.list_dominios_motoristas_for_admin() from public;
grant execute on function public.list_dominios_motoristas_for_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Recria as políticas de mentoria_cards sem admin_taxi.
-- ---------------------------------------------------------------------------
do $do$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'mentoria_cards'
  loop
    execute format('drop policy if exists %I on public.mentoria_cards', pol.policyname);
  end loop;
end
$do$;

create policy mentoria_cards_select
  on public.mentoria_cards
  for select
  to authenticated
  using (
    ativo = true
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role in ('admin_master', 'admin_transfer')
    )
  );

create policy mentoria_cards_insert
  on public.mentoria_cards
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role in ('admin_master', 'admin_transfer')
    )
  );

create policy mentoria_cards_update
  on public.mentoria_cards
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role in ('admin_master', 'admin_transfer')
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role in ('admin_master', 'admin_transfer')
    )
  );

create policy mentoria_cards_delete
  on public.mentoria_cards
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role in ('admin_master', 'admin_transfer')
    )
  );

-- ---------------------------------------------------------------------------
-- 5) Avisos: drop colunas incluir_taxi / paginas_taxi e ajusta constraint.
-- ---------------------------------------------------------------------------
update public.admin_avisos_plataforma
   set incluir_login = true
 where coalesce(incluir_motorista, false) = false
   and coalesce(incluir_login, false) = false;

alter table public.admin_avisos_plataforma
  drop constraint if exists admin_avisos_plataforma_publico_check;

alter table public.admin_avisos_plataforma
  drop column if exists incluir_taxi,
  drop column if exists paginas_taxi;

alter table public.admin_avisos_plataforma
  add constraint admin_avisos_plataforma_publico_check
  check (incluir_motorista = true or incluir_login = true);

-- ---------------------------------------------------------------------------
-- 6) Banners em tela cheia: idem.
-- ---------------------------------------------------------------------------
update public.admin_fullscreen_banners
   set incluir_motorista = true
 where coalesce(incluir_motorista, false) = false;

alter table public.admin_fullscreen_banners
  drop constraint if exists admin_fullscreen_banners_publico;

alter table public.admin_fullscreen_banners
  drop column if exists incluir_taxi,
  drop column if exists paginas_taxi;

alter table public.admin_fullscreen_banners
  add constraint admin_fullscreen_banners_publico
  check (incluir_motorista = true);

-- ---------------------------------------------------------------------------
-- 7) Logs de erro no painel: tira 'taxi' da check e remove linhas legadas.
-- ---------------------------------------------------------------------------
delete from public.painel_client_error_logs where painel = 'taxi';

alter table public.painel_client_error_logs
  drop constraint if exists painel_client_error_logs_painel_chk;

alter table public.painel_client_error_logs
  add constraint painel_client_error_logs_painel_chk
  check (painel in ('motorista_executivo', 'admin_master'));

-- ---------------------------------------------------------------------------
-- 8) BLINDAGEM do admin_master.
-- ---------------------------------------------------------------------------

-- 8.1) Limite duro: só pode existir UM registro com role = 'admin_master'.
create unique index if not exists user_roles_one_admin_master_uniq
  on public.user_roles ((1))
  where role = 'admin_master';

comment on index public.user_roles_one_admin_master_uniq is
  'Plataforma só admite um único admin_master. Tentativas de inserir outro falharão com violação de unicidade.';

-- 8.2) Trigger que impede DELETE da linha admin_master e UPDATE que troque a role.
create or replace function public.user_roles_protect_admin_master()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'admin_master' then
      raise exception 'Conta admin_master é protegida e não pode ser removida pelo banco.'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.role = 'admin_master' and new.role is distinct from 'admin_master' then
      raise exception 'Conta admin_master é protegida: não é possível trocar a role.'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  return null;
end;
$$;

comment on function public.user_roles_protect_admin_master() is
  'Blindagem: impede DELETE da linha admin_master (incluindo cascata de auth.users) e UPDATE que retire a role admin_master.';

drop trigger if exists user_roles_protect_admin_master_tr on public.user_roles;
create trigger user_roles_protect_admin_master_tr
  before delete or update on public.user_roles
  for each row execute function public.user_roles_protect_admin_master();
