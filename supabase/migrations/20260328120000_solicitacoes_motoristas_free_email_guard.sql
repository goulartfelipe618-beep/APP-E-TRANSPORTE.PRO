-- Reforço no banco: cadastro FREE pela landing não deve gravar solicitação se o e-mail
-- já tinha conta no momento da captura (espelha a regra da edge function webhook-solicitacao).

alter table public.solicitacoes_motoristas
  add column if not exists email_had_account_at_intake boolean not null default false;

comment on column public.solicitacoes_motoristas.email_had_account_at_intake is
  'True se o e-mail já existia em auth no momento do webhook (antes de criar usuário novo). Usado para bloquear FREE duplicado.';

create or replace function public.solicitacoes_motoristas_enforce_free_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pl text;
begin
  if new.lead_user_id is null or new.email is null then
    return new;
  end if;

  select p.plano into pl
  from public.user_plans p
  where p.user_id = new.lead_user_id
  limit 1;

  if pl is null then
    return new;
  end if;

  if pl = 'free' and coalesce(new.email_had_account_at_intake, false) = true then
    raise exception 'Cadastro FREE não permitido: e-mail já possui conta.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists solicitacoes_motoristas_enforce_free_email_trigger
  on public.solicitacoes_motoristas;

create trigger solicitacoes_motoristas_enforce_free_email_trigger
  before insert on public.solicitacoes_motoristas
  for each row
  execute function public.solicitacoes_motoristas_enforce_free_email();
