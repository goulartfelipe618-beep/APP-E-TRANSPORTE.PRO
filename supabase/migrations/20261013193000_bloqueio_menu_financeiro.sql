-- O menu Financeiro da conta só muda depois do código do autenticador (JWT aal2).

alter table public.configuracoes
  add column if not exists financeiro_bloqueado boolean not null default false;

comment on column public.configuracoes.financeiro_bloqueado is
  'Quando verdadeiro, o painel e as consultas do financeiro desta conta ficam ocultos até um código TOTP válido.';

create or replace function public.financeiro_esta_bloqueado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select c.financeiro_bloqueado
    from public.configuracoes c
    where c.user_id = (select auth.uid())
    limit 1
  ), false);
$$;

revoke all on function public.financeiro_esta_bloqueado() from public, anon, authenticated;
grant execute on function public.financeiro_esta_bloqueado() to authenticated;

create or replace function public.guard_financeiro_bloqueado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.financeiro_bloqueado, false)
       and coalesce(current_setting('app.financeiro_bloqueio_ok', true), '') <> 'on' then
      new.financeiro_bloqueado := false;
    end if;
    return new;
  end if;
  if new.financeiro_bloqueado is distinct from old.financeiro_bloqueado
     and coalesce(current_setting('app.financeiro_bloqueio_ok', true), '') <> 'on' then
    raise exception 'O menu financeiro só muda com o código do autenticador.';
  end if;
  return new;
end;
$$;

drop trigger if exists configuracoes_guard_financeiro_bloqueado on public.configuracoes;
create trigger configuracoes_guard_financeiro_bloqueado
  before insert or update on public.configuracoes
  for each row
  execute function public.guard_financeiro_bloqueado();

create or replace function public.definir_bloqueio_financeiro(p_bloquear boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Não autorizado';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'Confirme o código do autenticador.';
  end if;
  perform set_config('app.financeiro_bloqueio_ok', 'on', true);
  update public.configuracoes
  set financeiro_bloqueado = coalesce(p_bloquear, false),
      updated_at = now()
  where user_id = auth.uid();
  if not found then
    insert into public.configuracoes (user_id, financeiro_bloqueado)
    values (auth.uid(), coalesce(p_bloquear, false));
  end if;
end;
$$;

revoke all on function public.definir_bloqueio_financeiro(boolean) from public, anon;
grant execute on function public.definir_bloqueio_financeiro(boolean) to authenticated;

drop policy if exists financial_transactions_oculto_se_bloqueado on public.financial_transactions;
create policy financial_transactions_oculto_se_bloqueado
  on public.financial_transactions
  as restrictive
  for all
  to authenticated
  using (not public.financeiro_esta_bloqueado())
  with check (not public.financeiro_esta_bloqueado());
