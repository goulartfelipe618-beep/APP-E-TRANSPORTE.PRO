-- Portal motorista da frota: link fixo por cadastro, auth próprio, leitura só de reservas atribuídas.

-- ---------------------------------------------------------------------------
-- Colunas em solicitacoes_motoristas
-- ---------------------------------------------------------------------------
alter table public.solicitacoes_motoristas
  add column if not exists portal_token uuid unique;

alter table public.solicitacoes_motoristas
  add column if not exists portal_auth_user_id uuid references auth.users (id) on delete set null;

alter table public.solicitacoes_motoristas
  add column if not exists portal_login_email text;

comment on column public.solicitacoes_motoristas.portal_token is
  'Token secreto para URL do portal do motorista da frota (submotorista).';
comment on column public.solicitacoes_motoristas.portal_auth_user_id is
  'auth.users.id após definir senha no portal.';
comment on column public.solicitacoes_motoristas.portal_login_email is
  'Email sintético usado no Supabase Auth para este motorista da frota.';

update public.solicitacoes_motoristas
set portal_token = gen_random_uuid()
where portal_token is null;

alter table public.solicitacoes_motoristas
  alter column portal_token set not null;

alter table public.solicitacoes_motoristas
  alter column portal_token set default gen_random_uuid();

create unique index if not exists solicitacoes_motoristas_portal_auth_user_id_uidx
  on public.solicitacoes_motoristas (portal_auth_user_id)
  where portal_auth_user_id is not null;

-- ---------------------------------------------------------------------------
-- RLS: submotorista lê a própria ficha (para contexto do painel)
-- ---------------------------------------------------------------------------
drop policy if exists solicitacoes_motoristas_select_scope on public.solicitacoes_motoristas;
create policy solicitacoes_motoristas_select_scope
  on public.solicitacoes_motoristas
  for select
  to authenticated
  using (
    public.is_admin_master((select auth.uid()))
    or (
      user_id is not null
      and user_id = (select auth.uid())
      and status = 'cadastrado'
    )
    or (
      portal_auth_user_id is not null
      and portal_auth_user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Leitura de branding / contratos do dono da frota pelo submotorista
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'configuracoes' and c.relrowsecurity
  ) then
    execute $p$
      drop policy if exists configuracoes_select_for_frota_motorista on public.configuracoes;
      create policy configuracoes_select_for_frota_motorista
        on public.configuracoes for select to authenticated
        using (
          exists (
            select 1 from public.solicitacoes_motoristas sm
            where sm.portal_auth_user_id = (select auth.uid())
              and sm.user_id = configuracoes.user_id
          )
        );
    $p$;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'contratos' and c.relrowsecurity
  ) then
    execute $p$
      drop policy if exists contratos_select_for_frota_motorista on public.contratos;
      create policy contratos_select_for_frota_motorista
        on public.contratos for select to authenticated
        using (
          exists (
            select 1 from public.solicitacoes_motoristas sm
            where sm.portal_auth_user_id = (select auth.uid())
              and sm.user_id = contratos.user_id
          )
        );
    $p$;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'cabecalho_contratual' and c.relrowsecurity
  ) then
    execute $p$
      drop policy if exists cabecalho_contratual_select_for_frota_motorista on public.cabecalho_contratual;
      create policy cabecalho_contratual_select_for_frota_motorista
        on public.cabecalho_contratual for select to authenticated
        using (
          exists (
            select 1 from public.solicitacoes_motoristas sm
            where sm.portal_auth_user_id = (select auth.uid())
              and sm.user_id = cabecalho_contratual.user_id
          )
        );
    $p$;
  end if;
end $$;

-- Se não houver RLS, políticas não são criadas (PDF já funcionava).

-- Branding do dono da frota para o layout do submotorista (não expõe outras contas).
create or replace function public.get_frota_motorista_branding()
returns table (logo_url text, nome_projeto text, owner_user_id uuid, motorista_nome text)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(c.logo_url, '')::text,
    coalesce(c.nome_projeto, '')::text,
    sm.user_id,
    sm.nome::text
  from public.solicitacoes_motoristas sm
  left join public.configuracoes c on c.user_id = sm.user_id
  where sm.portal_auth_user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.get_frota_motorista_branding() to authenticated;

comment on function public.get_frota_motorista_branding() is
  'Motorista da frota: dados de marca do operador que cadastrou (sidebar).';

-- ---------------------------------------------------------------------------
-- UPDATE reservas: motorista da frota só altera status (trigger valida)
-- ---------------------------------------------------------------------------
drop policy if exists "reservas_transfer_update_as_frota_motorista" on public.reservas_transfer;
create policy "reservas_transfer_update_as_frota_motorista"
  on public.reservas_transfer
  for update
  to authenticated
  using (
    motorista_id is not null
    and trim(motorista_id) = (select auth.uid())::text
    and exists (
      select 1 from public.solicitacoes_motoristas sm
      where sm.portal_auth_user_id = (select auth.uid())
    )
  )
  with check (
    motorista_id is not null
    and trim(motorista_id) = (select auth.uid())::text
    and user_id = (
      select sm.user_id from public.solicitacoes_motoristas sm
      where sm.portal_auth_user_id = (select auth.uid())
      limit 1
    )
  );

drop policy if exists "reservas_grupos_update_as_frota_motorista" on public.reservas_grupos;
create policy "reservas_grupos_update_as_frota_motorista"
  on public.reservas_grupos
  for update
  to authenticated
  using (
    motorista_id is not null
    and motorista_id = (select auth.uid())
    and exists (
      select 1 from public.solicitacoes_motoristas sm
      where sm.portal_auth_user_id = (select auth.uid())
    )
  )
  with check (
    motorista_id is not null
    and motorista_id = (select auth.uid())
    and user_id = (
      select sm.user_id from public.solicitacoes_motoristas sm
      where sm.portal_auth_user_id = (select auth.uid())
      limit 1
    )
  );

create or replace function public.trg_reservas_transfer_frota_motorista_guard()
returns trigger
language plpgsql
as $$
declare
  v_frota boolean;
begin
  select exists (
    select 1 from public.solicitacoes_motoristas sm
    where sm.portal_auth_user_id = auth.uid()
  ) into v_frota;

  if not v_frota then
    return new;
  end if;

  if trim(coalesce(old.motorista_id, '')) is distinct from auth.uid()::text then
    raise exception 'Motorista da frota: apenas reservas atribuídas a si.';
  end if;

  if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Apenas o campo status pode ser alterado pelo motorista da frota.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reservas_transfer_frota_motorista_guard on public.reservas_transfer;
create trigger trg_reservas_transfer_frota_motorista_guard
  before update on public.reservas_transfer
  for each row
  execute function public.trg_reservas_transfer_frota_motorista_guard();

create or replace function public.trg_reservas_grupos_frota_motorista_guard()
returns trigger
language plpgsql
as $$
declare
  v_frota boolean;
begin
  select exists (
    select 1 from public.solicitacoes_motoristas sm
    where sm.portal_auth_user_id = auth.uid()
  ) into v_frota;

  if not v_frota then
    return new;
  end if;

  if old.motorista_id is distinct from auth.uid() then
    raise exception 'Motorista da frota: apenas reservas atribuídas a si.';
  end if;

  if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Apenas o campo status pode ser alterado pelo motorista da frota.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reservas_grupos_frota_motorista_guard on public.reservas_grupos;
create trigger trg_reservas_grupos_frota_motorista_guard
  before update on public.reservas_grupos
  for each row
  execute function public.trg_reservas_grupos_frota_motorista_guard();
