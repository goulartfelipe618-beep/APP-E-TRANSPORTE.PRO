-- Cadastro completo de veículos separado do cadastro de motoristas.
-- Inclui parâmetros operacionais para cálculo de corridas e imagens do veículo.

create table if not exists public.veiculos_frota (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo_veiculo text not null check (tipo_veiculo in ('carro', 'van')),
  marca text not null,
  modelo text not null,
  ano text not null,
  cor text null,
  placa text not null,
  combustivel text not null,
  renavam text null,
  chassi text null,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  observacoes text null,
  valor_km numeric(12,2) not null default 0,
  valor_hora numeric(12,2) not null default 0,
  tarifa_base numeric(12,2) not null default 0,
  valor_minimo_corrida numeric(12,2) not null default 0,
  distancia_minima_km numeric(12,2) not null default 0,
  tempo_tolerancia_min numeric(12,2) not null default 0,
  valor_hora_espera numeric(12,2) not null default 0,
  fracao_tempo_min numeric(12,2) not null default 15,
  tipo_cobranca text not null default 'hibrido' check (tipo_cobranca in ('km', 'hora', 'hibrido')),
  multiplicador_ida_volta numeric(12,2) not null default 2,
  permitir_preco_fixo_rota boolean not null default false,
  taxa_noturna_percentual numeric(12,2) not null default 0,
  taxa_aeroporto_fixa numeric(12,2) not null default 0,
  pedagio_modo text not null default 'manual' check (pedagio_modo in ('manual', 'automatico')),
  taxas_extras_json jsonb null,
  imagens_json jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists veiculos_frota_user_id_placa_uniq
  on public.veiculos_frota (user_id, upper(placa));

create index if not exists veiculos_frota_user_id_idx on public.veiculos_frota(user_id);

alter table public.veiculos_frota enable row level security;

drop policy if exists veiculos_frota_select on public.veiculos_frota;
create policy veiculos_frota_select
on public.veiculos_frota for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_staff()
);

drop policy if exists veiculos_frota_insert on public.veiculos_frota;
create policy veiculos_frota_insert
on public.veiculos_frota for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_platform_staff()
);

drop policy if exists veiculos_frota_update on public.veiculos_frota;
create policy veiculos_frota_update
on public.veiculos_frota for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_staff()
)
with check (
  user_id = auth.uid()
  or public.is_platform_staff()
);

drop policy if exists veiculos_frota_delete on public.veiculos_frota;
create policy veiculos_frota_delete
on public.veiculos_frota for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_staff()
);

create or replace function public.touch_veiculos_frota_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_veiculos_frota_updated_at on public.veiculos_frota;
create trigger trg_touch_veiculos_frota_updated_at
before update on public.veiculos_frota
for each row execute function public.touch_veiculos_frota_updated_at();

insert into storage.buckets (id, name, public)
values ('veiculos-imagens', 'veiculos-imagens', true)
on conflict (id) do nothing;

drop policy if exists veiculos_imagens_public_read on storage.objects;
create policy veiculos_imagens_public_read
on storage.objects for select to public
using (bucket_id = 'veiculos-imagens');

drop policy if exists veiculos_imagens_auth_insert on storage.objects;
create policy veiculos_imagens_auth_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'veiculos-imagens'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists veiculos_imagens_auth_update on storage.objects;
create policy veiculos_imagens_auth_update
on storage.objects for update to authenticated
using (
  bucket_id = 'veiculos-imagens'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'veiculos-imagens'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists veiculos_imagens_auth_delete on storage.objects;
create policy veiculos_imagens_auth_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'veiculos-imagens'
  and split_part(name, '/', 1) = auth.uid()::text
);
