-- Repasse ao motorista (despesa automática) ao concluir reserva + status operacional normalizado.
-- Receita continua a vir de valor_total (trigger existente). A margem da operação = receita − repasse (ambos no financeiro).

-- ---------------------------------------------------------------------------
-- Colunas nas reservas
-- ---------------------------------------------------------------------------
alter table public.reservas_transfer
  add column if not exists repasse_motorista numeric(14, 2) check (repasse_motorista is null or repasse_motorista >= 0);

comment on column public.reservas_transfer.repasse_motorista is
  'Valor a pagar ao motorista pela viagem (despesa da operação ao concluir).';

alter table public.reservas_grupos
  add column if not exists repasse_motorista numeric(14, 2) check (repasse_motorista is null or repasse_motorista >= 0);

comment on column public.reservas_grupos.repasse_motorista is
  'Valor a pagar ao motorista pelo serviço (despesa ao concluir).';

-- Status padrão para novas reservas (texto livre legado continua válido)
alter table public.reservas_transfer alter column status set default 'pendente';
alter table public.reservas_grupos alter column status set default 'pendente';

-- ---------------------------------------------------------------------------
-- Origens financeiras: repasse (despesa) ligado à mesma reserva
-- ---------------------------------------------------------------------------
alter table public.financial_transactions drop constraint if exists financial_transactions_origin_check;
alter table public.financial_transactions drop constraint if exists financial_transactions_origin_fk;

alter table public.financial_transactions add constraint financial_transactions_origin_check
  check (origin in (
    'reserva_transfer',
    'reserva_grupo',
    'manual',
    'repasse_reserva_transfer',
    'repasse_reserva_grupo'
  ));

alter table public.financial_transactions add constraint financial_transactions_origin_fk check (
  (origin = 'manual' and reserva_transfer_id is null and reserva_grupo_id is null)
  or (origin = 'reserva_transfer' and reserva_transfer_id is not null and reserva_grupo_id is null)
  or (origin = 'reserva_grupo' and reserva_grupo_id is not null and reserva_transfer_id is null)
  or (origin = 'repasse_reserva_transfer' and reserva_transfer_id is not null and reserva_grupo_id is null)
  or (origin = 'repasse_reserva_grupo' and reserva_grupo_id is not null and reserva_transfer_id is null)
);

-- Garantir kind coerente (dados legados)
update public.financial_transactions
set kind = 'receita'
where origin in ('reserva_transfer', 'reserva_grupo') and kind is distinct from 'receita';

create unique index if not exists financial_transactions_repasse_transfer_unique
  on public.financial_transactions (reserva_transfer_id)
  where origin = 'repasse_reserva_transfer';

create unique index if not exists financial_transactions_repasse_grupo_unique
  on public.financial_transactions (reserva_grupo_id)
  where origin = 'repasse_reserva_grupo';

-- ---------------------------------------------------------------------------
-- Concluída: alinhado à app (pendente / em_andamento / concluida / cancelada + texto legado)
-- ---------------------------------------------------------------------------
create or replace function public._reserva_status_concluida(p_status text)
returns boolean
language sql
immutable
as $$
  select
    length(trim(coalesce(p_status, ''))) > 0
    and (
      lower(trim(coalesce(p_status, ''))) in ('concluida', 'concluída', 'realizada', 'finalizada', 'concluido')
      or lower(trim(coalesce(p_status, ''))) like any (array[
        '%concluí%', '%concluid%', '%realiz%', '%finaliz%', '%complet%', '%feito%', '%atend%', '%encerr%'
      ])
    );
$$;

-- ---------------------------------------------------------------------------
-- Trigger: após atualizar reserva transfer — gerar despesa de repasse
-- ---------------------------------------------------------------------------
create or replace function public.trg_reservas_transfer_repasse_financeiro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_concl boolean := public._reserva_status_concluida(NEW.status);
  v_val numeric(14, 2);
begin
  if TG_OP <> 'UPDATE' then
    return NEW;
  end if;
  v_val := coalesce(NEW.repasse_motorista, 0);
  if not v_concl or v_val <= 0 then
    return NEW;
  end if;
  if exists (
    select 1 from public.financial_transactions f
    where f.reserva_transfer_id = NEW.id and f.origin = 'repasse_reserva_transfer'
  ) then
    return NEW;
  end if;

  perform set_config('app.financial_reserva_sync', 'on', true);

  insert into public.financial_transactions (
    user_id, kind, origin, payment_status, amount, occurred_on, description,
    reserva_transfer_id, category, is_primary
  )
  values (
    NEW.user_id,
    'despesa',
    'repasse_reserva_transfer',
    'pending',
    v_val,
    coalesce(
      (NEW.ida_data)::date,
      (NEW.por_hora_data)::date,
      (NEW.volta_data)::date,
      (NEW.created_at at time zone 'America/Sao_Paulo')::date
    ),
    'Repasse motorista · Reserva #' || NEW.numero_reserva::text,
    NEW.id,
    'repasse_motorista',
    false
  );

  perform set_config('app.financial_reserva_sync', 'off', true);
  return NEW;
end;
$$;

drop trigger if exists trg_reservas_transfer_repasse_financeiro on public.reservas_transfer;
create trigger trg_reservas_transfer_repasse_financeiro
  after update on public.reservas_transfer
  for each row
  execute function public.trg_reservas_transfer_repasse_financeiro();

-- ---------------------------------------------------------------------------
-- Grupos
-- ---------------------------------------------------------------------------
create or replace function public.trg_reservas_grupos_repasse_financeiro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_concl boolean := public._reserva_status_concluida(NEW.status);
  v_val numeric(14, 2);
begin
  if TG_OP <> 'UPDATE' then
    return NEW;
  end if;
  v_val := coalesce(NEW.repasse_motorista, 0);
  if not v_concl or v_val <= 0 then
    return NEW;
  end if;
  if exists (
    select 1 from public.financial_transactions f
    where f.reserva_grupo_id = NEW.id and f.origin = 'repasse_reserva_grupo'
  ) then
    return NEW;
  end if;

  perform set_config('app.financial_reserva_sync', 'on', true);

  insert into public.financial_transactions (
    user_id, kind, origin, payment_status, amount, occurred_on, description,
    reserva_grupo_id, category, is_primary
  )
  values (
    NEW.user_id,
    'despesa',
    'repasse_reserva_grupo',
    'pending',
    v_val,
    coalesce((NEW.data_ida)::date, (NEW.data_retorno)::date, (NEW.created_at at time zone 'America/Sao_Paulo')::date),
    'Repasse motorista · Grupo #' || NEW.numero_reserva::text,
    NEW.id,
    'repasse_motorista',
    false
  );

  perform set_config('app.financial_reserva_sync', 'off', true);
  return NEW;
end;
$$;

drop trigger if exists trg_reservas_grupos_repasse_financeiro on public.reservas_grupos;
create trigger trg_reservas_grupos_repasse_financeiro
  after update on public.reservas_grupos
  for each row
  execute function public.trg_reservas_grupos_repasse_financeiro();

-- ---------------------------------------------------------------------------
-- Integridade INSERT/UPDATE: repasse com mesmo dono da reserva
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
      select 1 from public.reservas_transfer r
      where r.id = new.reserva_transfer_id and r.user_id = new.user_id
    ) then
      raise exception 'financial_transactions.user_id deve coincidir com reservas_transfer.user_id';
    end if;
    return new;
  end if;

  if new.origin = 'repasse_reserva_transfer' then
    if new.kind is distinct from 'despesa' then
      raise exception 'repasse_reserva_transfer exige kind = despesa';
    end if;
    if new.reserva_transfer_id is null then
      raise exception 'reserva_transfer_id obrigatório';
    end if;
    if not exists (
      select 1 from public.reservas_transfer r
      where r.id = new.reserva_transfer_id and r.user_id = new.user_id
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
      select 1 from public.reservas_grupos g
      where g.id = new.reserva_grupo_id and g.user_id = new.user_id
    ) then
      raise exception 'financial_transactions.user_id deve coincidir com reservas_grupos.user_id';
    end if;
    return new;
  end if;

  if new.origin = 'repasse_reserva_grupo' then
    if new.kind is distinct from 'despesa' then
      raise exception 'repasse_reserva_grupo exige kind = despesa';
    end if;
    if new.reserva_grupo_id is null then
      raise exception 'reserva_grupo_id obrigatório';
    end if;
    if not exists (
      select 1 from public.reservas_grupos g
      where g.id = new.reserva_grupo_id and g.user_id = new.user_id
    ) then
      raise exception 'financial_transactions.user_id deve coincidir com reservas_grupos.user_id';
    end if;
    return new;
  end if;

  raise exception 'origin inválido';
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS INSERT: incluir origens de repasse
-- ---------------------------------------------------------------------------
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
      or (
        origin = 'repasse_reserva_transfer'
        and reserva_transfer_id is not null
        and exists (
          select 1 from public.reservas_transfer r
          where r.id = reserva_transfer_id and r.user_id = (select auth.uid())
        )
      )
      or (
        origin = 'repasse_reserva_grupo'
        and reserva_grupo_id is not null
        and exists (
          select 1 from public.reservas_grupos g
          where g.id = reserva_grupo_id and g.user_id = (select auth.uid())
        )
      )
    )
  );
