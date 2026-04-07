-- Campanhas com automação/webhook dedicado e leads por campanha.

create table if not exists public.campanhas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nome text not null,
  slug text not null,
  plataforma_fonte text,
  link_campanha text,
  cor text,
  descricao text,
  data_inicio date not null,
  data_fim date not null,
  status text not null default 'ativa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campanhas_status_check check (status in ('ativa', 'pausada', 'encerrada')),
  constraint campanhas_periodo_check check (data_fim >= data_inicio)
);

create unique index if not exists campanhas_user_slug_key
  on public.campanhas (user_id, slug);

create index if not exists campanhas_user_status_idx
  on public.campanhas (user_id, status, data_fim);

alter table public.campanhas enable row level security;

create policy "campanhas_select_own"
  on public.campanhas
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "campanhas_insert_own"
  on public.campanhas
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "campanhas_update_own"
  on public.campanhas
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "campanhas_delete_own"
  on public.campanhas
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.campanha_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  automacao_id uuid references public.automacoes(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  campos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists campanha_leads_user_campanha_idx
  on public.campanha_leads (user_id, campanha_id, created_at desc);

alter table public.campanha_leads enable row level security;

create policy "campanha_leads_select_own"
  on public.campanha_leads
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "campanha_leads_insert_own"
  on public.campanha_leads
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "campanha_leads_update_own"
  on public.campanha_leads
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "campanha_leads_delete_own"
  on public.campanha_leads
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

alter table public.automacoes
  add column if not exists campanha_id uuid references public.campanhas(id) on delete cascade,
  add column if not exists is_campaign_webhook boolean not null default false;

create index if not exists automacoes_campanha_id_idx
  on public.automacoes (campanha_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists campanhas_touch_updated_at on public.campanhas;
create trigger campanhas_touch_updated_at
before update on public.campanhas
for each row execute function public.touch_updated_at();

create or replace function public.prevent_active_campaign_delete()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'ativa' and current_date between old.data_inicio and old.data_fim then
    raise exception 'Campanha ativa no período não pode ser excluída.';
  end if;
  return old;
end;
$$;

drop trigger if exists campanhas_prevent_active_delete on public.campanhas;
create trigger campanhas_prevent_active_delete
before delete on public.campanhas
for each row execute function public.prevent_active_campaign_delete();
