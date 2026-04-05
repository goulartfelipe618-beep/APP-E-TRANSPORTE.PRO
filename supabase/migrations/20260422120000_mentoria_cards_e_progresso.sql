-- Mentoria: cards de conteúdo e progresso por usuário.
-- Corrige 400 (Bad Request) em GET /mentoria_progresso quando a tabela não existe,
-- colunas divergem do app (ex.: falta user_id) ou RLS bloqueia sem política adequada.

create table if not exists public.mentoria_cards (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  titulo text not null,
  descricao text,
  imagem_url text not null,
  video_url text,
  materiais text,
  link_url text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mentoria_progresso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.mentoria_cards (id) on delete cascade,
  concluido boolean not null default false,
  concluido_em timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, card_id)
);

create index if not exists mentoria_progresso_user_id_idx on public.mentoria_progresso (user_id);
create index if not exists mentoria_cards_ativo_ordem_idx on public.mentoria_cards (ativo, ordem);

alter table public.mentoria_cards enable row level security;
alter table public.mentoria_progresso enable row level security;

-- Leitura de cards: motoristas veem só ativos; contas com papel admin veem todos.
drop policy if exists mentoria_cards_select on public.mentoria_cards;
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
        and ur.role in ('admin_master', 'admin_transfer', 'admin_taxi')
    )
  );

drop policy if exists mentoria_cards_insert on public.mentoria_cards;
create policy mentoria_cards_insert
  on public.mentoria_cards
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role in ('admin_master', 'admin_transfer', 'admin_taxi')
    )
  );

drop policy if exists mentoria_cards_update on public.mentoria_cards;
create policy mentoria_cards_update
  on public.mentoria_cards
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role in ('admin_master', 'admin_transfer', 'admin_taxi')
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role in ('admin_master', 'admin_transfer', 'admin_taxi')
    )
  );

drop policy if exists mentoria_cards_delete on public.mentoria_cards;
create policy mentoria_cards_delete
  on public.mentoria_cards
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role in ('admin_master', 'admin_transfer', 'admin_taxi')
    )
  );

-- Progresso: cada usuário só acessa as próprias linhas.
drop policy if exists mentoria_progresso_select on public.mentoria_progresso;
create policy mentoria_progresso_select
  on public.mentoria_progresso
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists mentoria_progresso_insert on public.mentoria_progresso;
create policy mentoria_progresso_insert
  on public.mentoria_progresso
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists mentoria_progresso_update on public.mentoria_progresso;
create policy mentoria_progresso_update
  on public.mentoria_progresso
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists mentoria_progresso_delete on public.mentoria_progresso;
create policy mentoria_progresso_delete
  on public.mentoria_progresso
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.mentoria_cards to authenticated;
grant select, insert, update, delete on public.mentoria_progresso to authenticated;
