-- Multitenant performance + integridade financeira (defesa em profundidade).
-- RLS existente em financial_transactions / reservas / veículos mantém-se; isto acrescenta
-- índices alinhados a filtros por user_id e um trigger que impede user_id inconsistente com a reserva.

-- ---------------------------------------------------------------------------
-- Índices: financial_transactions (listagens por conta, mês, estado)
-- ---------------------------------------------------------------------------
create index if not exists financial_transactions_user_created_idx
  on public.financial_transactions (user_id, created_at desc);

create index if not exists financial_transactions_user_payment_idx
  on public.financial_transactions (user_id, payment_status);

-- occurred_on já coberto por financial_transactions_user_occurred_idx (migração inicial);
-- reforço parcial para pendentes (dashboard “a receber”)
create index if not exists financial_transactions_user_pending_occurred_idx
  on public.financial_transactions (user_id, occurred_on desc)
  where payment_status = 'pending';

-- ---------------------------------------------------------------------------
-- Índices: reservas (painel por dono + ordenação temporal)
-- ---------------------------------------------------------------------------
create index if not exists reservas_transfer_user_created_idx
  on public.reservas_transfer (user_id, created_at desc);

create index if not exists reservas_transfer_user_status_idx
  on public.reservas_transfer (user_id, status);

create index if not exists reservas_grupos_user_created_idx
  on public.reservas_grupos (user_id, created_at desc);

create index if not exists reservas_grupos_user_status_idx
  on public.reservas_grupos (user_id, status);

-- ---------------------------------------------------------------------------
-- Índices: veículos frota (listagem por conta)
-- ---------------------------------------------------------------------------
create index if not exists veiculos_frota_user_created_idx
  on public.veiculos_frota (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Integridade: user_id do lançamento = user_id da reserva vinculada
-- (RLS + política INSERT já restringem; isto bloqueia bypass / bugs em triggers futuros)
-- ---------------------------------------------------------------------------
create or replace function public.trg_financial_transactions_enforce_reserva_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.origin = 'manual' then
    if new.reserva_transfer_id is not null or new.reserva_grupo_id is not null then
      raise exception 'Lançamento manual não pode referenciar reserva';
    end if;
    return new;
  end if;

  if new.origin = 'reserva_transfer' then
    if new.reserva_transfer_id is null then
      raise exception 'reserva_transfer_id obrigatório para origin reserva_transfer';
    end if;
    if not exists (
      select 1
      from public.reservas_transfer r
      where r.id = new.reserva_transfer_id
        and r.user_id = new.user_id
    ) then
      raise exception 'financial_transactions.user_id deve coincidir com reservas_transfer.user_id';
    end if;
    return new;
  end if;

  if new.origin = 'reserva_grupo' then
    if new.reserva_grupo_id is null then
      raise exception 'reserva_grupo_id obrigatório para origin reserva_grupo';
    end if;
    if not exists (
      select 1
      from public.reservas_grupos g
      where g.id = new.reserva_grupo_id
        and g.user_id = new.user_id
    ) then
      raise exception 'financial_transactions.user_id deve coincidir com reservas_grupos.user_id';
    end if;
    return new;
  end if;

  raise exception 'origin inválido';
end;
$$;

drop trigger if exists trg_financial_transactions_enforce_reserva_owner on public.financial_transactions;
create trigger trg_financial_transactions_enforce_reserva_owner
  before insert or update on public.financial_transactions
  for each row
  execute function public.trg_financial_transactions_enforce_reserva_owner();

comment on function public.trg_financial_transactions_enforce_reserva_owner() is
  'Garante consistência multitenant: user_id do lançamento alinha com o dono da reserva (transfer/grupo).';
