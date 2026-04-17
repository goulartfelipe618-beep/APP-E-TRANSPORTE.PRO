-- Rastreios ao vivo (Geolocalizador): tabela dedicada ao streaming de posição
-- consumido pelo frontend via Supabase Realtime (postgres_changes).
--
-- Segurança:
--   * RLS sempre ligada.
--   * SELECT/INSERT/UPDATE/DELETE restritos ao dono (user_id = auth.uid())
--     ou a staff da plataforma (public.is_platform_staff()).
--   * Acesso público via token (link partilhado ao cliente) é exposto apenas
--     através da RPC get_rastreio_publico(token) — NUNCA por policy aberta.
--
-- Realtime:
--   * Tabela adicionada à publication supabase_realtime.
--   * REPLICA IDENTITY FULL para o payload postgres_changes conter a linha toda.

create table if not exists public.rastreios_ao_vivo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Vínculos opcionais com reservas existentes (para a Central cruzar).
  reserva_transfer_id uuid references public.reservas_transfer (id) on delete set null,
  reserva_grupo_id uuid references public.reservas_grupos (id) on delete set null,

  -- Identificação de quem está sendo rastreado (motorista/veículo) — texto livre
  -- para compatibilizar com motoristas fora da plataforma.
  motorista_nome text,
  veiculo_descricao text,

  -- Token aleatório para link público (cliente vê o mapa sem login via RPC).
  -- 64 chars hex (~256 bits de entropia) sem depender de pgcrypto.
  token text not null default (
    replace(gen_random_uuid()::text, '-', '')
    || replace(gen_random_uuid()::text, '-', '')
  ),

  -- Última posição conhecida (atualizada continuamente pelo app do motorista).
  latitude double precision,
  longitude double precision,
  heading double precision,                  -- direção (graus 0-359)
  speed_kmh double precision,                -- velocidade instantânea
  accuracy_m double precision,               -- precisão do GPS em metros

  status text not null default 'ativo'
    check (status in ('ativo', 'pausado', 'finalizado')),

  iniciado_em timestamptz not null default now(),
  ultima_atualizacao timestamptz,
  finalizado_em timestamptz,
  expira_em timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rastreios_ao_vivo_token_unique unique (token),
  constraint rastreios_ao_vivo_latitude_range  check (latitude  is null or (latitude  between -90  and 90)),
  constraint rastreios_ao_vivo_longitude_range check (longitude is null or (longitude between -180 and 180))
);

comment on table public.rastreios_ao_vivo is
  'Posição ao vivo de motoristas/veículos. Consumida pelo frontend via Realtime (postgres_changes).';

create index if not exists rastreios_ao_vivo_user_created_idx
  on public.rastreios_ao_vivo (user_id, created_at desc);
create index if not exists rastreios_ao_vivo_status_idx
  on public.rastreios_ao_vivo (status) where status = 'ativo';
create index if not exists rastreios_ao_vivo_reserva_transfer_idx
  on public.rastreios_ao_vivo (reserva_transfer_id) where reserva_transfer_id is not null;
create index if not exists rastreios_ao_vivo_reserva_grupo_idx
  on public.rastreios_ao_vivo (reserva_grupo_id) where reserva_grupo_id is not null;

-- Trigger updated_at
create or replace function public.rastreios_ao_vivo_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if (new.latitude  is distinct from old.latitude)
     or (new.longitude is distinct from old.longitude) then
    new.ultima_atualizacao := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rastreios_ao_vivo_updated_at on public.rastreios_ao_vivo;
create trigger trg_rastreios_ao_vivo_updated_at
  before update on public.rastreios_ao_vivo
  for each row execute function public.rastreios_ao_vivo_set_updated_at();

-- Histórico opcional (breadcrumbs) — útil se depois quiseres linha do percurso.
create table if not exists public.rastreios_ao_vivo_pontos (
  id bigserial primary key,
  rastreio_id uuid not null references public.rastreios_ao_vivo (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  heading double precision,
  speed_kmh double precision,
  accuracy_m double precision,
  registrado_em timestamptz not null default now()
);

create index if not exists rastreios_ao_vivo_pontos_rastreio_idx
  on public.rastreios_ao_vivo_pontos (rastreio_id, registrado_em desc);

comment on table public.rastreios_ao_vivo_pontos is
  'Histórico de pontos (breadcrumbs) do rastreio ao vivo. Insere 1 linha por ping GPS.';

-- ============================================================
-- RLS
-- ============================================================
alter table public.rastreios_ao_vivo enable row level security;
alter table public.rastreios_ao_vivo_pontos enable row level security;

drop policy if exists rastreios_ao_vivo_select_own on public.rastreios_ao_vivo;
create policy rastreios_ao_vivo_select_own
  on public.rastreios_ao_vivo for select to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_staff());

drop policy if exists rastreios_ao_vivo_insert_own on public.rastreios_ao_vivo;
create policy rastreios_ao_vivo_insert_own
  on public.rastreios_ao_vivo for insert to authenticated
  with check (user_id = (select auth.uid()) or public.is_platform_staff());

drop policy if exists rastreios_ao_vivo_update_own on public.rastreios_ao_vivo;
create policy rastreios_ao_vivo_update_own
  on public.rastreios_ao_vivo for update to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_staff())
  with check (user_id = (select auth.uid()) or public.is_platform_staff());

drop policy if exists rastreios_ao_vivo_delete_own on public.rastreios_ao_vivo;
create policy rastreios_ao_vivo_delete_own
  on public.rastreios_ao_vivo for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_staff());

drop policy if exists rastreios_ao_vivo_pontos_select_own on public.rastreios_ao_vivo_pontos;
create policy rastreios_ao_vivo_pontos_select_own
  on public.rastreios_ao_vivo_pontos for select to authenticated
  using (
    exists (
      select 1 from public.rastreios_ao_vivo r
      where r.id = rastreios_ao_vivo_pontos.rastreio_id
        and (r.user_id = (select auth.uid()) or public.is_platform_staff())
    )
  );

drop policy if exists rastreios_ao_vivo_pontos_insert_own on public.rastreios_ao_vivo_pontos;
create policy rastreios_ao_vivo_pontos_insert_own
  on public.rastreios_ao_vivo_pontos for insert to authenticated
  with check (
    exists (
      select 1 from public.rastreios_ao_vivo r
      where r.id = rastreios_ao_vivo_pontos.rastreio_id
        and (r.user_id = (select auth.uid()) or public.is_platform_staff())
    )
  );

drop policy if exists rastreios_ao_vivo_pontos_delete_own on public.rastreios_ao_vivo_pontos;
create policy rastreios_ao_vivo_pontos_delete_own
  on public.rastreios_ao_vivo_pontos for delete to authenticated
  using (
    exists (
      select 1 from public.rastreios_ao_vivo r
      where r.id = rastreios_ao_vivo_pontos.rastreio_id
        and (r.user_id = (select auth.uid()) or public.is_platform_staff())
    )
  );

-- ============================================================
-- RPC: acesso público leitura via token (para o link que o cliente abre)
-- Retorna APENAS colunas não sensíveis. SECURITY DEFINER para contornar RLS
-- apenas neste caminho controlado (token aleatório 18 bytes).
-- ============================================================
create or replace function public.get_rastreio_publico(p_token text)
returns table (
  id uuid,
  status text,
  motorista_nome text,
  veiculo_descricao text,
  latitude double precision,
  longitude double precision,
  heading double precision,
  speed_kmh double precision,
  ultima_atualizacao timestamptz,
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  expira_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.status, r.motorista_nome, r.veiculo_descricao,
         r.latitude, r.longitude, r.heading, r.speed_kmh,
         r.ultima_atualizacao, r.iniciado_em, r.finalizado_em, r.expira_em
    from public.rastreios_ao_vivo r
   where r.token = p_token
     and (r.expira_em is null or r.expira_em > now());
$$;

revoke all on function public.get_rastreio_publico(text) from public;
grant execute on function public.get_rastreio_publico(text) to anon, authenticated;

comment on function public.get_rastreio_publico(text) is
  'Leitura pública (por token) de um rastreio ao vivo — usado no link partilhado ao cliente.';

-- ============================================================
-- Realtime: REPLICA IDENTITY FULL + publication
-- ============================================================
alter table public.rastreios_ao_vivo replica identity full;
alter table public.rastreios_ao_vivo_pontos replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'rastreios_ao_vivo'
  ) then
    execute 'alter publication supabase_realtime add table public.rastreios_ao_vivo';
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'rastreios_ao_vivo_pontos'
  ) then
    execute 'alter publication supabase_realtime add table public.rastreios_ao_vivo_pontos';
  end if;
end
$$;
