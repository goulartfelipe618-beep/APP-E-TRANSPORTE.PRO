-- Comunicadores WhatsApp (Evolution): um registro global (oficial E-Transporte.pro) e até um por usuário (próprio).

create table if not exists public.comunicadores_evolution (
  id uuid primary key default gen_random_uuid(),
  escopo text not null check (escopo in ('sistema', 'usuario')),
  user_id uuid references auth.users (id) on delete cascade,
  rotulo text not null default '',
  instance_name text,
  qr_code_base64 text,
  connection_status text not null default 'desconectado',
  telefone_conectado text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comunicadores_evolution_escopo_user check (
    (escopo = 'sistema' and user_id is null)
    or (escopo = 'usuario' and user_id is not null)
  )
);

comment on table public.comunicadores_evolution is 'Instâncias Evolution: escopo sistema = oficial para todos os motoristas executivos; escopo usuario = WhatsApp próprio (máx. 1 por usuário).';
comment on column public.comunicadores_evolution.escopo is 'sistema: linha única oficial; usuario: comunicador pessoal vinculado a user_id.';

create unique index if not exists comunicadores_evolution_uq_sistema
  on public.comunicadores_evolution ((true))
  where escopo = 'sistema';

create unique index if not exists comunicadores_evolution_uq_usuario
  on public.comunicadores_evolution (user_id)
  where escopo = 'usuario';

insert into public.comunicadores_evolution (escopo, rotulo, connection_status)
select 'sistema', 'E-Transporte.pro — Comunicador oficial', 'desconectado'
where not exists (select 1 from public.comunicadores_evolution where escopo = 'sistema');

alter table public.comunicadores_evolution enable row level security;

-- Leitura do comunicador oficial: qualquer usuário autenticado
create policy "comunicadores_evolution_select_sistema"
  on public.comunicadores_evolution
  for select
  to authenticated
  using (escopo = 'sistema');

-- Leitura do próprio comunicador pessoal
create policy "comunicadores_evolution_select_own"
  on public.comunicadores_evolution
  for select
  to authenticated
  using (escopo = 'usuario' and user_id = (select auth.uid()));

-- Admin master: leitura/escrita do registro oficial
create policy "comunicadores_evolution_admin_sistema_all"
  on public.comunicadores_evolution
  for all
  to authenticated
  using (escopo = 'sistema' and public.is_admin_master((select auth.uid())))
  with check (escopo = 'sistema' and public.is_admin_master((select auth.uid())));

-- Comunicador pessoal (admin master ou motorista executivo): até um por conta
create policy "comunicadores_evolution_insert_own"
  on public.comunicadores_evolution
  for insert
  to authenticated
  with check (escopo = 'usuario' and user_id = (select auth.uid()));

create policy "comunicadores_evolution_update_own"
  on public.comunicadores_evolution
  for update
  to authenticated
  using (escopo = 'usuario' and user_id = (select auth.uid()))
  with check (escopo = 'usuario' and user_id = (select auth.uid()));

create policy "comunicadores_evolution_delete_own"
  on public.comunicadores_evolution
  for delete
  to authenticated
  using (escopo = 'usuario' and user_id = (select auth.uid()));
