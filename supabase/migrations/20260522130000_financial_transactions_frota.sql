-- Módulo financeiro (painel motorista executivo): lançamentos por conta (user_id), RLS isolado, vínculo a reservas.

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('receita', 'despesa')),
  origin text not null check (origin in ('reserva_transfer', 'reserva_grupo', 'manual')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'cancelled')),
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'BRL',
  occurred_on date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  description text,
  reserva_transfer_id uuid references public.reservas_transfer (id) on delete cascade,
  reserva_grupo_id uuid references public.reservas_grupos (id) on delete cascade,
  category text not null default 'geral',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_transactions_origin_fk check (
    (origin = 'reserva_transfer' and reserva_transfer_id is not null and reserva_grupo_id is null)
    or (origin = 'reserva_grupo' and reserva_grupo_id is not null and reserva_transfer_id is null)
    or (origin = 'manual' and reserva_transfer_id is null and reserva_grupo_id is null)
  )
);

create unique index if not exists financial_transactions_reserva_transfer_unique
  on public.financial_transactions (reserva_transfer_id)
  where reserva_transfer_id is not null;

create unique index if not exists financial_transactions_reserva_grupo_unique
  on public.financial_transactions (reserva_grupo_id)
  where reserva_grupo_id is not null;

create index if not exists financial_transactions_user_occurred_idx
  on public.financial_transactions (user_id, occurred_on desc);

comment on table public.financial_transactions is
  'Lançamentos financeiros da frota (motorista executivo). user_id = dono da conta; RLS restringe a auth.uid().';

-- ---------------------------------------------------------------------------
-- Triggers: reservas → receita automática (pendente ou cancelada)
-- ---------------------------------------------------------------------------

create or replace function public._financial_status_cancelled(p_status text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_status, '')) like '%cancel%';
$$;

create or replace function public.trg_reservas_transfer_financial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cancel boolean := public._financial_status_cancelled(NEW.status);
  v_day date := coalesce(
    (NEW.ida_data)::date,
    (NEW.por_hora_data)::date,
    (NEW.volta_data)::date,
    (NEW.created_at at time zone 'America/Sao_Paulo')::date
  );
begin
  if tg_op = 'INSERT' then
    if not v_cancel then
      insert into public.financial_transactions (
        user_id, kind, origin, payment_status, amount, occurred_on, description, reserva_transfer_id, category
      )
      values (
        NEW.user_id,
        'receita',
        'reserva_transfer',
        'pending',
        NEW.valor_total,
        v_day,
        'Reserva transfer #' || NEW.numero_reserva::text,
        NEW.id,
        'reserva_transfer'
      );
    end if;
    return NEW;
  end if;

  if tg_op = 'UPDATE' then
    if exists (select 1 from public.financial_transactions f where f.reserva_transfer_id = NEW.id) then
      update public.financial_transactions
      set
        amount = NEW.valor_total,
        user_id = NEW.user_id,
        payment_status = case when v_cancel then 'cancelled' else payment_status end,
        occurred_on = coalesce(
          (NEW.ida_data)::date,
          (NEW.por_hora_data)::date,
          (NEW.volta_data)::date,
          occurred_on
        ),
        updated_at = now()
      where reserva_transfer_id = NEW.id;
    elsif not v_cancel then
      insert into public.financial_transactions (
        user_id, kind, origin, payment_status, amount, occurred_on, description, reserva_transfer_id, category
      )
      values (
        NEW.user_id,
        'receita',
        'reserva_transfer',
        'pending',
        NEW.valor_total,
        v_day,
        'Reserva transfer #' || NEW.numero_reserva::text,
        NEW.id,
        'reserva_transfer'
      );
    end if;
    return NEW;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_reservas_transfer_financial_ai on public.reservas_transfer;
create trigger trg_reservas_transfer_financial_ai
  after insert on public.reservas_transfer
  for each row
  execute function public.trg_reservas_transfer_financial();

drop trigger if exists trg_reservas_transfer_financial_au on public.reservas_transfer;
create trigger trg_reservas_transfer_financial_au
  after update on public.reservas_transfer
  for each row
  execute function public.trg_reservas_transfer_financial();

create or replace function public.trg_reservas_grupos_financial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cancel boolean := public._financial_status_cancelled(NEW.status);
  v_day date := coalesce(
    (NEW.data_ida)::date,
    (NEW.data_retorno)::date,
    (NEW.created_at at time zone 'America/Sao_Paulo')::date
  );
begin
  if tg_op = 'INSERT' then
    if not v_cancel then
      insert into public.financial_transactions (
        user_id, kind, origin, payment_status, amount, occurred_on, description, reserva_grupo_id, category
      )
      values (
        NEW.user_id,
        'receita',
        'reserva_grupo',
        'pending',
        NEW.valor_total,
        v_day,
        'Reserva grupo #' || NEW.numero_reserva::text,
        NEW.id,
        'reserva_grupo'
      );
    end if;
    return NEW;
  end if;

  if tg_op = 'UPDATE' then
    if exists (select 1 from public.financial_transactions f where f.reserva_grupo_id = NEW.id) then
      update public.financial_transactions
      set
        amount = NEW.valor_total,
        user_id = NEW.user_id,
        payment_status = case when v_cancel then 'cancelled' else payment_status end,
        occurred_on = coalesce((NEW.data_ida)::date, (NEW.data_retorno)::date, occurred_on),
        updated_at = now()
      where reserva_grupo_id = NEW.id;
    elsif not v_cancel then
      insert into public.financial_transactions (
        user_id, kind, origin, payment_status, amount, occurred_on, description, reserva_grupo_id, category
      )
      values (
        NEW.user_id,
        'receita',
        'reserva_grupo',
        'pending',
        NEW.valor_total,
        v_day,
        'Reserva grupo #' || NEW.numero_reserva::text,
        NEW.id,
        'reserva_grupo'
      );
    end if;
    return NEW;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_reservas_grupos_financial_ai on public.reservas_grupos;
create trigger trg_reservas_grupos_financial_ai
  after insert on public.reservas_grupos
  for each row
  execute function public.trg_reservas_grupos_financial();

drop trigger if exists trg_reservas_grupos_financial_au on public.reservas_grupos;
create trigger trg_reservas_grupos_financial_au
  after update on public.reservas_grupos
  for each row
  execute function public.trg_reservas_grupos_financial();

-- ---------------------------------------------------------------------------
-- Backfill (não duplica: índice único por reserva)
-- ---------------------------------------------------------------------------

insert into public.financial_transactions (
  user_id, kind, origin, payment_status, amount, occurred_on, description, reserva_transfer_id, category
)
select
  r.user_id,
  'receita',
  'reserva_transfer',
  case when public._financial_status_cancelled(r.status) then 'cancelled' else 'pending' end,
  r.valor_total,
  coalesce(
    (r.ida_data)::date,
    (r.por_hora_data)::date,
    (r.volta_data)::date,
    (r.created_at at time zone 'America/Sao_Paulo')::date
  ),
  'Reserva transfer #' || r.numero_reserva::text,
  r.id,
  'reserva_transfer'
from public.reservas_transfer r
where not exists (
  select 1 from public.financial_transactions f where f.reserva_transfer_id = r.id
);

insert into public.financial_transactions (
  user_id, kind, origin, payment_status, amount, occurred_on, description, reserva_grupo_id, category
)
select
  g.user_id,
  'receita',
  'reserva_grupo',
  case when public._financial_status_cancelled(g.status) then 'cancelled' else 'pending' end,
  g.valor_total,
  coalesce(
    (g.data_ida)::date,
    (g.data_retorno)::date,
    (g.created_at at time zone 'America/Sao_Paulo')::date
  ),
  'Reserva grupo #' || g.numero_reserva::text,
  g.id,
  'reserva_grupo'
from public.reservas_grupos g
where not exists (
  select 1 from public.financial_transactions f where f.reserva_grupo_id = g.id
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.financial_transactions enable row level security;

drop policy if exists "financial_transactions_select_own" on public.financial_transactions;
create policy "financial_transactions_select_own"
  on public.financial_transactions for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "financial_transactions_select_staff" on public.financial_transactions;
create policy "financial_transactions_select_staff"
  on public.financial_transactions for select to authenticated
  using (public.is_platform_staff());

drop policy if exists "financial_transactions_insert_own" on public.financial_transactions;
create policy "financial_transactions_insert_own"
  on public.financial_transactions for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "financial_transactions_update_own" on public.financial_transactions;
create policy "financial_transactions_update_own"
  on public.financial_transactions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "financial_transactions_delete_own" on public.financial_transactions;
create policy "financial_transactions_delete_own"
  on public.financial_transactions for delete to authenticated
  using (user_id = (select auth.uid()) and origin = 'manual');

grant select, insert, update, delete on public.financial_transactions to authenticated;
