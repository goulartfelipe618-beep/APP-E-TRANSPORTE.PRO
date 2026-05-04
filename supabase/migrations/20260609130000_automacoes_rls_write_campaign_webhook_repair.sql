-- =============================================================================
-- automacoes: políticas RLS de escrita para o dono + staff; reparação de
-- webhooks de campanha em falta; índice único por campanha.
-- Cada utilizador autenticado só lê/altera linhas com user_id = auth.uid();
-- is_platform_staff() mantém acesso administrativo (já alinhado ao SELECT gap).
-- =============================================================================

-- 1) Remover duplicados: uma automação de campanha por campanha_id (mantém o id mais antigo)
delete from public.automacoes a
where a.campanha_id is not null
  and exists (
    select 1
    from public.automacoes b
    where b.campanha_id = a.campanha_id
      and b.id < a.id
  );

create unique index if not exists automacoes_campanha_id_unique
  on public.automacoes (campanha_id)
  where campanha_id is not null;

-- 2) RLS: INSERT / UPDATE / DELETE para authenticated (dono ou staff)
alter table public.automacoes enable row level security;

drop policy if exists automacoes_insert_own_v1 on public.automacoes;
create policy automacoes_insert_own_v1
  on public.automacoes
  for insert
  to authenticated
  with check (
    public.is_platform_staff()
    or (user_id is not null and (select auth.uid()) = user_id)
  );

drop policy if exists automacoes_update_own_v1 on public.automacoes;
create policy automacoes_update_own_v1
  on public.automacoes
  for update
  to authenticated
  using (
    public.is_platform_staff()
    or (user_id is not null and (select auth.uid()) = user_id)
  )
  with check (
    public.is_platform_staff()
    or (user_id is not null and (select auth.uid()) = user_id)
  );

drop policy if exists automacoes_delete_own_v1 on public.automacoes;
create policy automacoes_delete_own_v1
  on public.automacoes
  for delete
  to authenticated
  using (
    public.is_platform_staff()
    or (user_id is not null and (select auth.uid()) = user_id)
  );

grant select, insert, update, delete on public.automacoes to authenticated;

-- 3) Backfill: campanhas não encerradas sem linha em automacoes
insert into public.automacoes (user_id, nome, tipo, ativo, mappings, campanha_id, is_campaign_webhook)
select
  c.user_id,
  c.nome,
  'campanha',
  true,
  '{}'::jsonb,
  c.id,
  true
from public.campanhas c
where c.status in ('ativa', 'pausada')
  and not exists (
    select 1
    from public.automacoes a
    where a.campanha_id = c.id
  )
on conflict do nothing;

-- 4) RPC: reparar em runtime (idempotente) — só campanhas do auth.uid()
create or replace function public.ensure_my_campaign_webhooks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    return;
  end if;

  insert into public.automacoes (user_id, nome, tipo, ativo, mappings, campanha_id, is_campaign_webhook)
  select
    c.user_id,
    c.nome,
    'campanha',
    true,
    '{}'::jsonb,
    c.id,
    true
  from public.campanhas c
  where c.user_id = uid
    and c.status in ('ativa', 'pausada')
    and not exists (
      select 1
      from public.automacoes a
      where a.campanha_id = c.id
    )
  on conflict do nothing;
end;
$$;

comment on function public.ensure_my_campaign_webhooks() is
  'Cria em falta o webhook (automacoes) para campanhas ativas/pausadas do utilizador autenticado. Idempotente.';

revoke all on function public.ensure_my_campaign_webhooks() from public;
grant execute on function public.ensure_my_campaign_webhooks() to authenticated;
