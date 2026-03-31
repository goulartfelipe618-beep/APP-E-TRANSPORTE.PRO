-- Comunidade: feed compartilhado entre admin, motoristas executivos e taxistas.

create or replace function public.is_admin_master(_user_id uuid)
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
      and ur.role = 'admin_master'
  );
$$;

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
      and ur.role in ('admin_master', 'admin_transfer', 'admin_taxi')
  );
$$;

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_edited boolean not null default false
);

create table if not exists public.community_post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  media_url text not null,
  storage_path text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.community_post_mentions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  mentioned_user_id uuid not null,
  mentioned_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (post_id, mentioned_user_id)
);

create table if not exists public.community_post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_edited boolean not null default false
);

create index if not exists community_posts_created_at_idx on public.community_posts (created_at desc);
create index if not exists community_post_media_post_idx on public.community_post_media (post_id, position);
create index if not exists community_post_mentions_post_idx on public.community_post_mentions (post_id);
create index if not exists community_post_likes_post_idx on public.community_post_likes (post_id);
create index if not exists community_post_comments_post_idx on public.community_post_comments (post_id, created_at desc);

alter table public.community_posts enable row level security;
alter table public.community_post_media enable row level security;
alter table public.community_post_mentions enable row level security;
alter table public.community_post_likes enable row level security;
alter table public.community_post_comments enable row level security;

drop policy if exists community_posts_select on public.community_posts;
create policy community_posts_select
  on public.community_posts
  for select
  to authenticated
  using (public.is_community_member((select auth.uid())));

drop policy if exists community_posts_insert on public.community_posts;
create policy community_posts_insert
  on public.community_posts
  for insert
  to authenticated
  with check (
    author_user_id = (select auth.uid())
    and public.is_community_member((select auth.uid()))
  );

drop policy if exists community_posts_update on public.community_posts;
create policy community_posts_update
  on public.community_posts
  for update
  to authenticated
  using (
    author_user_id = (select auth.uid())
    or public.is_admin_master((select auth.uid()))
  )
  with check (
    public.is_community_member((select auth.uid()))
    and (
      author_user_id = (select auth.uid())
      or public.is_admin_master((select auth.uid()))
    )
  );

drop policy if exists community_posts_delete on public.community_posts;
create policy community_posts_delete
  on public.community_posts
  for delete
  to authenticated
  using (
    author_user_id = (select auth.uid())
    or public.is_admin_master((select auth.uid()))
  );

drop policy if exists community_media_select on public.community_post_media;
create policy community_media_select
  on public.community_post_media
  for select
  to authenticated
  using (public.is_community_member((select auth.uid())));

drop policy if exists community_media_insert on public.community_post_media;
create policy community_media_insert
  on public.community_post_media
  for insert
  to authenticated
  with check (
    public.is_community_member((select auth.uid()))
    and exists (
      select 1
      from public.community_posts p
      where p.id = post_id
        and (
          p.author_user_id = (select auth.uid())
          or public.is_admin_master((select auth.uid()))
        )
    )
  );

drop policy if exists community_media_update on public.community_post_media;
create policy community_media_update
  on public.community_post_media
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.community_posts p
      where p.id = post_id
        and (
          p.author_user_id = (select auth.uid())
          or public.is_admin_master((select auth.uid()))
        )
    )
  )
  with check (
    public.is_community_member((select auth.uid()))
    and exists (
      select 1
      from public.community_posts p
      where p.id = post_id
        and (
          p.author_user_id = (select auth.uid())
          or public.is_admin_master((select auth.uid()))
        )
    )
  );

drop policy if exists community_media_delete on public.community_post_media;
create policy community_media_delete
  on public.community_post_media
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.community_posts p
      where p.id = post_id
        and (
          p.author_user_id = (select auth.uid())
          or public.is_admin_master((select auth.uid()))
        )
    )
  );

drop policy if exists community_mentions_select on public.community_post_mentions;
create policy community_mentions_select
  on public.community_post_mentions
  for select
  to authenticated
  using (public.is_community_member((select auth.uid())));

drop policy if exists community_mentions_insert on public.community_post_mentions;
create policy community_mentions_insert
  on public.community_post_mentions
  for insert
  to authenticated
  with check (
    mentioned_by_user_id = (select auth.uid())
    and public.is_community_member((select auth.uid()))
    and exists (
      select 1
      from public.community_posts p
      where p.id = post_id
        and (
          p.author_user_id = (select auth.uid())
          or public.is_admin_master((select auth.uid()))
        )
    )
  );

drop policy if exists community_mentions_delete on public.community_post_mentions;
create policy community_mentions_delete
  on public.community_post_mentions
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.community_posts p
      where p.id = post_id
        and (
          p.author_user_id = (select auth.uid())
          or public.is_admin_master((select auth.uid()))
        )
    )
  );

drop policy if exists community_likes_select on public.community_post_likes;
create policy community_likes_select
  on public.community_post_likes
  for select
  to authenticated
  using (public.is_community_member((select auth.uid())));

drop policy if exists community_likes_insert on public.community_post_likes;
create policy community_likes_insert
  on public.community_post_likes
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_community_member((select auth.uid()))
  );

drop policy if exists community_likes_delete on public.community_post_likes;
create policy community_likes_delete
  on public.community_post_likes
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_master((select auth.uid()))
  );

drop policy if exists community_comments_select on public.community_post_comments;
create policy community_comments_select
  on public.community_post_comments
  for select
  to authenticated
  using (public.is_community_member((select auth.uid())));

drop policy if exists community_comments_insert on public.community_post_comments;
create policy community_comments_insert
  on public.community_post_comments
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_community_member((select auth.uid()))
  );

drop policy if exists community_comments_update on public.community_post_comments;
create policy community_comments_update
  on public.community_post_comments
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_master((select auth.uid()))
  )
  with check (
    public.is_community_member((select auth.uid()))
    and (
      user_id = (select auth.uid())
      or public.is_admin_master((select auth.uid()))
    )
  );

drop policy if exists community_comments_delete on public.community_post_comments;
create policy community_comments_delete
  on public.community_post_comments
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin_master((select auth.uid()))
  );

insert into storage.buckets (id, name, public)
values ('community-media', 'community-media', true)
on conflict (id) do nothing;

drop policy if exists community_media_bucket_public_read on storage.objects;
create policy community_media_bucket_public_read
on storage.objects
for select
to public
using (bucket_id = 'community-media');

drop policy if exists community_media_bucket_auth_insert on storage.objects;
create policy community_media_bucket_auth_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'community-media'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and public.is_community_member((select auth.uid()))
);

drop policy if exists community_media_bucket_auth_update on storage.objects;
create policy community_media_bucket_auth_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'community-media'
  and (
    split_part(name, '/', 1) = (select auth.uid())::text
    or public.is_admin_master((select auth.uid()))
  )
)
with check (
  bucket_id = 'community-media'
  and public.is_community_member((select auth.uid()))
  and (
    split_part(name, '/', 1) = (select auth.uid())::text
    or public.is_admin_master((select auth.uid()))
  )
);

drop policy if exists community_media_bucket_auth_delete on storage.objects;
create policy community_media_bucket_auth_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'community-media'
  and (
    split_part(name, '/', 1) = (select auth.uid())::text
    or public.is_admin_master((select auth.uid()))
  )
);

do $do$
begin
  alter publication supabase_realtime add table public.community_posts;
exception
  when others then
    raise notice 'supabase_realtime add community_posts: %', sqlerrm;
end
$do$;

do $do$
begin
  alter publication supabase_realtime add table public.community_post_media;
exception
  when others then
    raise notice 'supabase_realtime add community_post_media: %', sqlerrm;
end
$do$;

do $do$
begin
  alter publication supabase_realtime add table public.community_post_mentions;
exception
  when others then
    raise notice 'supabase_realtime add community_post_mentions: %', sqlerrm;
end
$do$;

do $do$
begin
  alter publication supabase_realtime add table public.community_post_likes;
exception
  when others then
    raise notice 'supabase_realtime add community_post_likes: %', sqlerrm;
end
$do$;

do $do$
begin
  alter publication supabase_realtime add table public.community_post_comments;
exception
  when others then
    raise notice 'supabase_realtime add community_post_comments: %', sqlerrm;
end
$do$;
