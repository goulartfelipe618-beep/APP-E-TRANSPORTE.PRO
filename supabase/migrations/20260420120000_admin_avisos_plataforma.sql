-- Avisos do Admin Master no topo do conteúdo (motorista executivo / táxi).

create table public.admin_avisos_plataforma (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  cor text not null default 'amarelo'
    check (cor in ('verde', 'amarelo', 'vermelho')),
  escopo_global boolean not null default false,
  incluir_motorista boolean not null default true,
  incluir_taxi boolean not null default true,
  paginas_motorista text[] not null default '{}',
  paginas_taxi text[] not null default '{}',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.admin_avisos_plataforma is
  'Avisos exibidos no topo da área de conteúdo dos painéis motorista/táxi; gestão apenas admin_master.';

create index admin_avisos_plataforma_ativo_idx on public.admin_avisos_plataforma (ativo) where ativo = true;

alter table public.admin_avisos_plataforma enable row level security;

create policy "admin_avisos_plataforma_select_authenticated"
  on public.admin_avisos_plataforma for select to authenticated
  using (
    ativo = true
    or public.is_admin_master((select auth.uid()))
  );

create policy "admin_avisos_plataforma_insert_master"
  on public.admin_avisos_plataforma for insert to authenticated
  with check (public.is_admin_master((select auth.uid())));

create policy "admin_avisos_plataforma_update_master"
  on public.admin_avisos_plataforma for update to authenticated
  using (public.is_admin_master((select auth.uid())))
  with check (public.is_admin_master((select auth.uid())));

create policy "admin_avisos_plataforma_delete_master"
  on public.admin_avisos_plataforma for delete to authenticated
  using (public.is_admin_master((select auth.uid())));

grant select on public.admin_avisos_plataforma to authenticated;
grant insert, update, delete on public.admin_avisos_plataforma to authenticated;
