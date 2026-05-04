-- Clientes cadastrados pelo operador (isolamento por user_id). Ligação opcional em reservas_transfer / reservas_grupos.

create table public.cadastro_clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('pf', 'pj')),
  nome_exibicao text not null,
  cpf_cnpj text,
  email text,
  telefone_1 text,
  telefone_2 text,
  enderecos jsonb not null default '[]'::jsonb,
  documentos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cadastro_clientes is
  'Clientes PF/PJ do operador; enderecos = [{rotulo,endereco},...]; documentos = mapa slug->path no Storage.';

create index cadastro_clientes_user_id_idx on public.cadastro_clientes (user_id);
create index cadastro_clientes_user_created_idx on public.cadastro_clientes (user_id, created_at desc);

alter table public.reservas_transfer
  add column if not exists cadastro_cliente_id uuid references public.cadastro_clientes (id) on delete set null;

alter table public.reservas_grupos
  add column if not exists cadastro_cliente_id uuid references public.cadastro_clientes (id) on delete set null;

create index if not exists reservas_transfer_cadastro_cliente_id_idx on public.reservas_transfer (cadastro_cliente_id);
create index if not exists reservas_grupos_cadastro_cliente_id_idx on public.reservas_grupos (cadastro_cliente_id);

drop trigger if exists cadastro_clientes_touch_updated_at on public.cadastro_clientes;
create trigger cadastro_clientes_touch_updated_at
  before update on public.cadastro_clientes
  for each row execute function public.touch_updated_at();

-- Garante que o cliente referenciado pertence ao mesmo operador da reserva.
create or replace function public.reservas_transfer_validate_cadastro_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cadastro_cliente_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.cadastro_clientes c
    where c.id = new.cadastro_cliente_id and c.user_id = new.user_id
  ) then
    raise exception 'cadastro_cliente_id inválido para esta reserva';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reservas_transfer_validate_cadastro_cliente on public.reservas_transfer;
create trigger trg_reservas_transfer_validate_cadastro_cliente
  before insert or update on public.reservas_transfer
  for each row execute function public.reservas_transfer_validate_cadastro_cliente();

create or replace function public.reservas_grupos_validate_cadastro_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cadastro_cliente_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.cadastro_clientes c
    where c.id = new.cadastro_cliente_id and c.user_id = new.user_id
  ) then
    raise exception 'cadastro_cliente_id inválido para esta reserva';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reservas_grupos_validate_cadastro_cliente on public.reservas_grupos;
create trigger trg_reservas_grupos_validate_cadastro_cliente
  before insert or update on public.reservas_grupos
  for each row execute function public.reservas_grupos_validate_cadastro_cliente();

alter table public.cadastro_clientes enable row level security;

drop policy if exists cadastro_clientes_select_scope on public.cadastro_clientes;
create policy cadastro_clientes_select_scope
  on public.cadastro_clientes for select to authenticated
  using (user_id = auth.uid() or public.is_platform_staff());

drop policy if exists cadastro_clientes_insert_scope on public.cadastro_clientes;
create policy cadastro_clientes_insert_scope
  on public.cadastro_clientes for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.is_platform_staff()
  );

drop policy if exists cadastro_clientes_update_scope on public.cadastro_clientes;
create policy cadastro_clientes_update_scope
  on public.cadastro_clientes for update to authenticated
  using (user_id = auth.uid() or public.is_platform_staff())
  with check (
    user_id = auth.uid()
    or public.is_platform_staff()
  );

drop policy if exists cadastro_clientes_delete_scope on public.cadastro_clientes;
create policy cadastro_clientes_delete_scope
  on public.cadastro_clientes for delete to authenticated
  using (user_id = auth.uid() or public.is_platform_staff());

-- Storage: documentos do cliente (paths {user_id}/{cliente_id}/...)
insert into storage.buckets (id, name, public)
values ('cadastro-clientes-docs', 'cadastro-clientes-docs', false)
on conflict (id) do nothing;

drop policy if exists cadastro_clientes_docs_select_owner on storage.objects;
create policy cadastro_clientes_docs_select_owner
  on storage.objects for select to authenticated
  using (
    bucket_id = 'cadastro-clientes-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists cadastro_clientes_docs_insert_owner on storage.objects;
create policy cadastro_clientes_docs_insert_owner
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'cadastro-clientes-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists cadastro_clientes_docs_update_owner on storage.objects;
create policy cadastro_clientes_docs_update_owner
  on storage.objects for update to authenticated
  using (
    bucket_id = 'cadastro-clientes-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'cadastro-clientes-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists cadastro_clientes_docs_delete_owner on storage.objects;
create policy cadastro_clientes_docs_delete_owner
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'cadastro-clientes-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  );
