-- Credenciais Evolution só para admin master (URL/KEY não expostas aos motoristas).
-- nome_dispositivo no público para exibir o nome amigável do aparelho/linha oficial.

alter table public.comunicadores_evolution
  add column if not exists nome_dispositivo text;

comment on column public.comunicadores_evolution.nome_dispositivo is 'Nome amigável do dispositivo/linha (ex.: WhatsApp Central E-Transporte). Visível a todos.';

create table if not exists public.comunicador_evolution_credenciais (
  id uuid primary key default gen_random_uuid(),
  comunicador_id uuid not null references public.comunicadores_evolution (id) on delete cascade,
  api_url text not null default '',
  api_key text not null default '',
  updated_at timestamptz not null default now(),
  constraint comunicador_evolution_credenciais_uq_comunicador unique (comunicador_id)
);

comment on table public.comunicador_evolution_credenciais is 'URL e API Key Evolution do comunicador oficial; apenas admin_master (RLS).';

alter table public.comunicador_evolution_credenciais enable row level security;

create policy "comunicador_evolution_credenciais_admin_all"
  on public.comunicador_evolution_credenciais
  for all
  to authenticated
  using (public.is_admin_master((select auth.uid())))
  with check (public.is_admin_master((select auth.uid())));
