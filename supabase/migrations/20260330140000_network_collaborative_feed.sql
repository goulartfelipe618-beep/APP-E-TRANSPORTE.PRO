-- Network: feed colaborativo entre motoristas executivos e visão do admin master.
-- Remove atribuição individual; todos com role adequado veem todas as publicações.

alter table public.network
  add column if not exists autor_nome text,
  add column if not exists autor_email text;

comment on column public.network.autor_nome is 'Nome exibido do autor (denormalizado no insert).';
comment on column public.network.autor_email is 'E-mail do autor no momento da publicação (denormalizado).';

alter table public.network drop column if exists motorista_atribuido_id;

create index if not exists network_created_at_idx on public.network (created_at desc);

alter table public.network enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'network'
  loop
    execute format('drop policy if exists %I on public.network', pol.policyname);
  end loop;
end $$;

-- Leitura: motoristas executivos e admin master
create policy network_select_collaborative
  on public.network
  for select
  to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role in ('admin_master', 'admin_transfer')
    )
  );

-- Inclusão: apenas como próprio autor, e com role permitido
create policy network_insert_collaborative
  on public.network
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role in ('admin_master', 'admin_transfer')
    )
  );

-- Exclusão: autor ou admin master
create policy network_delete_own
  on public.network
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy network_delete_master
  on public.network
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role = 'admin_master'
    )
  );

-- Atualização: apenas o autor (edição futura); admin pode usar service role se necessário
create policy network_update_own
  on public.network
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Realtime (Postgres changes no cliente)
do $do$
begin
  alter publication supabase_realtime add table public.network;
exception
  when others then
    raise notice 'supabase_realtime add network: %', sqlerrm;
end
$do$;
