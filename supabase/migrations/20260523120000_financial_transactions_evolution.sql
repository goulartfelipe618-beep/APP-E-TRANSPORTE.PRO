-- Evolução do financeiro: N lançamentos por reserva (só 1 "principal"), sync só se pendente,
-- método de pagamento, data de baixa (paid_at), proteção contra edição alienígena.

alter table public.financial_transactions
  add column if not exists is_primary boolean not null default false;

alter table public.financial_transactions
  add column if not exists payment_method text;

alter table public.financial_transactions
  add column if not exists paid_at timestamptz;

alter table public.financial_transactions
  drop constraint if exists financial_transactions_payment_method_check;

alter table public.financial_transactions
  add constraint financial_transactions_payment_method_check
  check (
    payment_method is null
    or payment_method in ('pix', 'dinheiro', 'cartao', 'transferencia')
  );

comment on column public.financial_transactions.is_primary is
  'Receita automática da reserva = true (sincroniza com valor_total enquanto pendente). Extras mesma reserva: is_primary = false.';

comment on column public.financial_transactions.payment_method is
  'Meio quando pago: pix, dinheiro, cartao, transferencia.';

comment on column public.financial_transactions.paid_at is
  'Momento em que o pagamento foi confirmado (baixa no caixa).';

-- Marcar linhas existentes de reserva como principal
update public.financial_transactions
set is_primary = true
where origin in ('reserva_transfer', 'reserva_grupo');

-- Índice único: no máximo uma linha PRINCIPAL por reserva (permite N extras com is_primary = false)
drop index if exists public.financial_transactions_reserva_transfer_unique;
drop index if exists public.financial_transactions_reserva_grupo_unique;

create unique index if not exists financial_transactions_primary_transfer_unique
  on public.financial_transactions (reserva_transfer_id)
  where reserva_transfer_id is not null and is_primary = true;

create unique index if not exists financial_transactions_primary_grupo_unique
  on public.financial_transactions (reserva_grupo_id)
  where reserva_grupo_id is not null and is_primary = true;

create index if not exists financial_transactions_reserva_transfer_idx
  on public.financial_transactions (reserva_transfer_id)
  where reserva_transfer_id is not null;

create index if not exists financial_transactions_reserva_grupo_idx
  on public.financial_transactions (reserva_grupo_id)
  where reserva_grupo_id is not null;

-- ---------------------------------------------------------------------------
-- Proteção: não editar valor/campos-chave de lançamentos automáticos pelo cliente (só via trigger reserva)
-- ---------------------------------------------------------------------------

create or replace function public.trg_financial_transactions_update_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op <> 'UPDATE' then
    return NEW;
  end if;
  if OLD.origin = 'manual' then
    return NEW;
  end if;
  if coalesce(current_setting('app.financial_reserva_sync', true), '') = 'on' then
    return NEW;
  end if;
  if NEW.kind is distinct from OLD.kind
     or NEW.origin is distinct from OLD.origin
     or NEW.reserva_transfer_id is distinct from OLD.reserva_transfer_id
     or NEW.reserva_grupo_id is distinct from OLD.reserva_grupo_id
     or NEW.is_primary is distinct from OLD.is_primary
     or NEW.currency is distinct from OLD.currency
     or NEW.user_id is distinct from OLD.user_id then
    raise exception 'Não é permitido alterar a estrutura deste lançamento automático';
  end if;
  if NEW.amount is distinct from OLD.amount then
    raise exception 'O valor deste lançamento segue a reserva (enquanto pendente) ou registe um lançamento manual à parte';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_financial_transactions_update_guard on public.financial_transactions;
create trigger trg_financial_transactions_update_guard
  before update on public.financial_transactions
  for each row
  execute function public.trg_financial_transactions_update_guard();

-- ---------------------------------------------------------------------------
-- Triggers reserva: criar principal; sincronizar só principal pendente; cancelar todas as linhas da reserva
-- ---------------------------------------------------------------------------

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
  perform set_config('app.financial_reserva_sync', 'on', true);

  if tg_op = 'INSERT' then
    if not v_cancel then
      if not exists (
        select 1 from public.financial_transactions f
        where f.reserva_transfer_id = NEW.id and f.is_primary = true
      ) then
        insert into public.financial_transactions (
          user_id, kind, origin, payment_status, amount, occurred_on, description, reserva_transfer_id, category, is_primary
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
          'reserva_transfer',
          true
        );
      end if;
    end if;
    perform set_config('app.financial_reserva_sync', 'off', true);
    return NEW;
  end if;

  if tg_op = 'UPDATE' then
    if v_cancel then
      update public.financial_transactions
      set
        payment_status = 'cancelled',
        paid_at = null,
        payment_method = null,
        updated_at = now()
      where reserva_transfer_id = NEW.id;
    else
      update public.financial_transactions
      set
        amount = NEW.valor_total,
        user_id = NEW.user_id,
        occurred_on = coalesce(
          (NEW.ida_data)::date,
          (NEW.por_hora_data)::date,
          (NEW.volta_data)::date,
          occurred_on
        ),
        updated_at = now()
      where reserva_transfer_id = NEW.id
        and is_primary = true
        and payment_status = 'pending';

      if not exists (
        select 1 from public.financial_transactions f where f.reserva_transfer_id = NEW.id and f.is_primary = true
      ) then
        insert into public.financial_transactions (
          user_id, kind, origin, payment_status, amount, occurred_on, description, reserva_transfer_id, category, is_primary
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
          'reserva_transfer',
          true
        );
      end if;
    end if;
    perform set_config('app.financial_reserva_sync', 'off', true);
    return NEW;
  end if;

  perform set_config('app.financial_reserva_sync', 'off', true);
  return NEW;
end;
$$;

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
  perform set_config('app.financial_reserva_sync', 'on', true);

  if tg_op = 'INSERT' then
    if not v_cancel then
      if not exists (
        select 1 from public.financial_transactions f
        where f.reserva_grupo_id = NEW.id and f.is_primary = true
      ) then
        insert into public.financial_transactions (
          user_id, kind, origin, payment_status, amount, occurred_on, description, reserva_grupo_id, category, is_primary
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
          'reserva_grupo',
          true
        );
      end if;
    end if;
    perform set_config('app.financial_reserva_sync', 'off', true);
    return NEW;
  end if;

  if tg_op = 'UPDATE' then
    if v_cancel then
      update public.financial_transactions
      set
        payment_status = 'cancelled',
        paid_at = null,
        payment_method = null,
        updated_at = now()
      where reserva_grupo_id = NEW.id;
    else
      update public.financial_transactions
      set
        amount = NEW.valor_total,
        user_id = NEW.user_id,
        occurred_on = coalesce((NEW.data_ida)::date, (NEW.data_retorno)::date, occurred_on),
        updated_at = now()
      where reserva_grupo_id = NEW.id
        and is_primary = true
        and payment_status = 'pending';

      if not exists (
        select 1 from public.financial_transactions f where f.reserva_grupo_id = NEW.id and f.is_primary = true
      ) then
        insert into public.financial_transactions (
          user_id, kind, origin, payment_status, amount, occurred_on, description, reserva_grupo_id, category, is_primary
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
          'reserva_grupo',
          true
        );
      end if;
    end if;
    perform set_config('app.financial_reserva_sync', 'off', true);
    return NEW;
  end if;

  perform set_config('app.financial_reserva_sync', 'off', true);
  return NEW;
end;
$$;

-- Política INSERT: linhas automáticas só com reserva do próprio utilizador (além do trigger)
drop policy if exists "financial_transactions_insert_own" on public.financial_transactions;
create policy "financial_transactions_insert_own"
  on public.financial_transactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      origin = 'manual'
      or (
        origin = 'reserva_transfer'
        and reserva_transfer_id is not null
        and exists (
          select 1 from public.reservas_transfer r
          where r.id = reserva_transfer_id and r.user_id = (select auth.uid())
        )
      )
      or (
        origin = 'reserva_grupo'
        and reserva_grupo_id is not null
        and exists (
          select 1 from public.reservas_grupos g
          where g.id = reserva_grupo_id and g.user_id = (select auth.uid())
        )
      )
    )
  );
