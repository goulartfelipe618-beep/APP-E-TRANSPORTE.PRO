-- ============================================================================
--  CATÁLOGO do motorista executivo (feature BETA)
--  - Guarda configuração do catálogo comercial em PDF por usuário
--  - Bucket de Storage para imagens personalizadas (capa/fim/galeria)
-- ============================================================================

-- 1. Tabela de configuração do catálogo ----------------------------------------
create table if not exists public.catalogos_motorista (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Conteúdo textual
  slogan text not null default 'TRANSPORTE PREMIUM',
  subtitulo text not null default 'Conforto, segurança e elegância em cada trajeto.',
  sobre_nos text not null default '',

  -- Identidade comercial
  instagram_handle text,
  site_url text,
  whatsapp_e164 text,

  -- Áreas e listas (JSON)
  cidades_atendidas jsonb not null default '[]'::jsonb,
  servicos_destaque jsonb not null default '[]'::jsonb,
  comodidades jsonb not null default '[]'::jsonb,

  -- Visual
  tema text not null default 'dark' check (tema in ('dark', 'graphite', 'noir', 'midnight')),
  cor_acento text not null default '#FF6600',
  banner_capa_url text,
  banner_contracapa_url text,

  -- Metadados
  ultimo_pdf_gerado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id)
);

create index if not exists catalogos_motorista_user_id_idx
  on public.catalogos_motorista (user_id);

-- 2. Trigger para updated_at ---------------------------------------------------
create or replace function public.catalogos_motorista_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists catalogos_motorista_touch_updated_at_tg on public.catalogos_motorista;
create trigger catalogos_motorista_touch_updated_at_tg
before update on public.catalogos_motorista
for each row execute function public.catalogos_motorista_touch_updated_at();

-- 3. Row Level Security --------------------------------------------------------
alter table public.catalogos_motorista enable row level security;

-- Cada utilizador vê/edita apenas a sua linha (e platform staff tem acesso total)
drop policy if exists "catalogos_motorista_select_own" on public.catalogos_motorista;
create policy "catalogos_motorista_select_own"
  on public.catalogos_motorista
  for select
  using (
    user_id = auth.uid()
    or public.is_platform_staff()
  );

drop policy if exists "catalogos_motorista_insert_own" on public.catalogos_motorista;
create policy "catalogos_motorista_insert_own"
  on public.catalogos_motorista
  for insert
  with check (user_id = auth.uid());

drop policy if exists "catalogos_motorista_update_own" on public.catalogos_motorista;
create policy "catalogos_motorista_update_own"
  on public.catalogos_motorista
  for update
  using (user_id = auth.uid() or public.is_platform_staff())
  with check (user_id = auth.uid() or public.is_platform_staff());

drop policy if exists "catalogos_motorista_delete_own" on public.catalogos_motorista;
create policy "catalogos_motorista_delete_own"
  on public.catalogos_motorista
  for delete
  using (user_id = auth.uid() or public.is_platform_staff());

-- 4. Storage bucket para imagens do catálogo ----------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalogo-motorista',
  'catalogo-motorista',
  true,
  15 * 1024 * 1024,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Policies do bucket: leitura pública, escrita apenas do próprio user
drop policy if exists "catalogo_motorista_storage_read" on storage.objects;
create policy "catalogo_motorista_storage_read"
  on storage.objects
  for select
  using (bucket_id = 'catalogo-motorista');

drop policy if exists "catalogo_motorista_storage_insert_own" on storage.objects;
create policy "catalogo_motorista_storage_insert_own"
  on storage.objects
  for insert
  with check (
    bucket_id = 'catalogo-motorista'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "catalogo_motorista_storage_update_own" on storage.objects;
create policy "catalogo_motorista_storage_update_own"
  on storage.objects
  for update
  using (
    bucket_id = 'catalogo-motorista'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'catalogo-motorista'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "catalogo_motorista_storage_delete_own" on storage.objects;
create policy "catalogo_motorista_storage_delete_own"
  on storage.objects
  for delete
  using (
    bucket_id = 'catalogo-motorista'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
