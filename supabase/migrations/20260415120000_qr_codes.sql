-- QR Codes de marketing (página Marketing → QR Code). Garante tabela + RLS no projeto remoto.

create table if not exists public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null default '',
  url_destino text not null,
  slug text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qr_codes_slug_unique unique (slug)
);

create index if not exists qr_codes_user_id_idx on public.qr_codes (user_id);
create index if not exists qr_codes_created_at_idx on public.qr_codes (created_at desc);

comment on table public.qr_codes is 'QR Codes permanentes por usuário (marketing).';

alter table public.qr_codes enable row level security;

drop policy if exists "qr_codes_select_own" on public.qr_codes;
drop policy if exists "qr_codes_insert_own" on public.qr_codes;
drop policy if exists "qr_codes_update_own" on public.qr_codes;
drop policy if exists "qr_codes_delete_own" on public.qr_codes;

create policy "qr_codes_select_own"
  on public.qr_codes for select to authenticated
  using (user_id = (select auth.uid()));

create policy "qr_codes_insert_own"
  on public.qr_codes for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "qr_codes_update_own"
  on public.qr_codes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "qr_codes_delete_own"
  on public.qr_codes for delete to authenticated
  using (user_id = (select auth.uid()));
