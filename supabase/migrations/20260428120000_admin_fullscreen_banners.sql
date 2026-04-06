-- Banners em tela cheia (Admin Master) para painéis motorista / táxi.

create table public.admin_fullscreen_banners (
  id uuid primary key default gen_random_uuid(),
  imagem_url text not null,
  incluir_motorista boolean not null default true,
  incluir_taxi boolean not null default true,
  paginas_motorista text[] not null default '{}',
  paginas_taxi text[] not null default '{}',
  data_inicio date not null,
  data_fim date not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_fullscreen_banners_dates check (data_fim >= data_inicio),
  constraint admin_fullscreen_banners_publico check (incluir_motorista = true or incluir_taxi = true)
);

comment on table public.admin_fullscreen_banners is
  'Banners modais em tela cheia; imagens em storage fullscreen-banners.';

create index admin_fullscreen_banners_ativo_idx on public.admin_fullscreen_banners (ativo) where ativo = true;

alter table public.admin_fullscreen_banners enable row level security;

create policy "admin_fullscreen_banners_select_authenticated"
  on public.admin_fullscreen_banners for select to authenticated
  using (
    ativo = true
    or public.is_admin_master((select auth.uid()))
  );

create policy "admin_fullscreen_banners_insert_master"
  on public.admin_fullscreen_banners for insert to authenticated
  with check (public.is_admin_master((select auth.uid())));

create policy "admin_fullscreen_banners_update_master"
  on public.admin_fullscreen_banners for update to authenticated
  using (public.is_admin_master((select auth.uid())))
  with check (public.is_admin_master((select auth.uid())));

create policy "admin_fullscreen_banners_delete_master"
  on public.admin_fullscreen_banners for delete to authenticated
  using (public.is_admin_master((select auth.uid())));

grant select on public.admin_fullscreen_banners to authenticated;
grant insert, update, delete on public.admin_fullscreen_banners to authenticated;

insert into storage.buckets (id, name, public)
values ('fullscreen-banners', 'fullscreen-banners', true)
on conflict (id) do nothing;

drop policy if exists fullscreen_banners_public_read on storage.objects;
create policy fullscreen_banners_public_read
on storage.objects for select to public
using (bucket_id = 'fullscreen-banners');

drop policy if exists fullscreen_banners_admin_insert on storage.objects;
create policy fullscreen_banners_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'fullscreen-banners'
  and public.is_admin_master((select auth.uid()))
);

drop policy if exists fullscreen_banners_admin_update on storage.objects;
create policy fullscreen_banners_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'fullscreen-banners' and public.is_admin_master((select auth.uid())))
with check (bucket_id = 'fullscreen-banners' and public.is_admin_master((select auth.uid())));

drop policy if exists fullscreen_banners_admin_delete on storage.objects;
create policy fullscreen_banners_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'fullscreen-banners' and public.is_admin_master((select auth.uid())));
