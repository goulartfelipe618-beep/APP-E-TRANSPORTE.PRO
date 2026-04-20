-- Erros capturados no browser (motorista / táxi / admin) para consulta no Admin Master → Logs.

create table if not exists public.painel_client_error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  painel text not null
    constraint painel_client_error_logs_painel_chk
    check (painel in ('motorista_executivo', 'admin_master', 'taxi')),
  active_page text,
  route_path text,
  kind text not null
    constraint painel_client_error_logs_kind_chk
    check (kind in ('error', 'unhandledrejection', 'react_boundary')),
  message text not null,
  stack text,
  component_stack text,
  user_display_name text,
  user_email text,
  user_agent text,
  extra jsonb not null default '{}'::jsonb
);

comment on table public.painel_client_error_logs is
  'Registos de erro/rejeição no painel web; inserção pelo próprio utilizador autenticado; leitura só admin_master.';

create index if not exists painel_client_error_logs_created_at_idx
  on public.painel_client_error_logs (created_at desc);

create index if not exists painel_client_error_logs_user_id_idx
  on public.painel_client_error_logs (user_id);

create index if not exists painel_client_error_logs_painel_idx
  on public.painel_client_error_logs (painel);

alter table public.painel_client_error_logs enable row level security;

create policy painel_client_error_logs_insert_own
  on public.painel_client_error_logs
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy painel_client_error_logs_select_admin_master
  on public.painel_client_error_logs
  for select
  to authenticated
  using (public.is_admin_master((select auth.uid())));

create policy painel_client_error_logs_delete_admin_master
  on public.painel_client_error_logs
  for delete
  to authenticated
  using (public.is_admin_master((select auth.uid())));

grant select, insert on table public.painel_client_error_logs to authenticated;
grant delete on table public.painel_client_error_logs to authenticated;

-- Atualização em tempo real no Admin Master → Logs (opcional; ignora se já existir).
do $rl$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'painel_client_error_logs'
  ) then
    alter publication supabase_realtime add table public.painel_client_error_logs;
  end if;
exception
  when undefined_object then
    null;
end
$rl$;
