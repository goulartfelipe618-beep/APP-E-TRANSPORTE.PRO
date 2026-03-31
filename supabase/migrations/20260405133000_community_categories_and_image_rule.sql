-- Comunidade: categorias e reforco da regra visual de imagens 1536x1024 no frontend.

create table if not exists public.community_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) > 0),
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

alter table public.community_posts
  add column if not exists category_id uuid references public.community_categories(id) on delete set null;

create index if not exists community_categories_name_idx on public.community_categories (name);
create index if not exists community_posts_category_idx on public.community_posts (category_id);

alter table public.community_categories enable row level security;

drop policy if exists community_categories_select on public.community_categories;
create policy community_categories_select
  on public.community_categories
  for select
  to authenticated
  using (public.is_community_member((select auth.uid())));

drop policy if exists community_categories_insert on public.community_categories;
create policy community_categories_insert
  on public.community_categories
  for insert
  to authenticated
  with check (
    public.is_admin_master((select auth.uid()))
    and created_by_user_id = (select auth.uid())
  );

drop policy if exists community_categories_update on public.community_categories;
create policy community_categories_update
  on public.community_categories
  for update
  to authenticated
  using (public.is_admin_master((select auth.uid())))
  with check (public.is_admin_master((select auth.uid())));

drop policy if exists community_categories_delete on public.community_categories;
create policy community_categories_delete
  on public.community_categories
  for delete
  to authenticated
  using (public.is_admin_master((select auth.uid())));

insert into public.community_categories (name, created_by_user_id)
select 'Geral', (select auth.uid())
where not exists (select 1 from public.community_categories where name = 'Geral')
  and (select auth.uid()) is not null;

do $do$
declare
  v_category_id uuid;
begin
  select id into v_category_id
  from public.community_categories
  where name = 'Geral'
  limit 1;

  if v_category_id is not null then
    update public.community_posts
    set category_id = v_category_id
    where category_id is null;
  end if;
end
$do$;

do $do$
begin
  alter publication supabase_realtime add table public.community_categories;
exception
  when others then
    raise notice 'supabase_realtime add community_categories: %', sqlerrm;
end
$do$;
