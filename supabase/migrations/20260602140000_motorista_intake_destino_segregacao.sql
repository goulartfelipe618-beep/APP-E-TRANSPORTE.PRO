-- Separa fila global da plataforma (cadastro para usar o sistema, só Admin Master)
-- de candidatos ao site do motorista executivo (webhook da própria frota).

alter table public.automacoes
  add column if not exists motorista_intake_destino text not null default 'frota_parceiros';

alter table public.automacoes
  drop constraint if exists automacoes_motorista_intake_destino_check;

alter table public.automacoes
  add constraint automacoes_motorista_intake_destino_check
  check (motorista_intake_destino in ('frota_parceiros', 'plataforma_landing'));

comment on column public.automacoes.motorista_intake_destino is
  'Para tipo motorista: frota_parceiros = candidatos ao site do utilizador (Motoristas→Solicitações); plataforma_landing = fila da landing global (só Admin Master).';

alter table public.solicitacoes_motoristas
  add column if not exists motorista_intake_destino text not null default 'frota_parceiros';

alter table public.solicitacoes_motoristas
  drop constraint if exists solicitacoes_motoristas_motorista_intake_destino_check;

alter table public.solicitacoes_motoristas
  add constraint solicitacoes_motoristas_motorista_intake_destino_check
  check (motorista_intake_destino in ('frota_parceiros', 'plataforma_landing'));

comment on column public.solicitacoes_motoristas.motorista_intake_destino is
  'frota_parceiros: dono da frota vê em Motoristas→Solicitações; plataforma_landing: apenas Admin Master.';

-- Corrigir linhas antigas quando a automação já estiver marcada como landing da plataforma
update public.solicitacoes_motoristas sm
set motorista_intake_destino = 'plataforma_landing'
from public.automacoes a
where (sm.dados_webhook->>'_webhook_automacao_id') = a.id::text
  and a.tipo = 'motorista'
  and a.motorista_intake_destino = 'plataforma_landing';

create or replace function public.automacoes_guard_motorista_intake_destino()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'motorista'
     and coalesce(new.motorista_intake_destino, 'frota_parceiros') = 'plataforma_landing' then
    if not public.is_admin_master((select auth.uid())) then
      raise exception 'Apenas Admin Master pode marcar automação motorista como fila da landing da plataforma.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_automacoes_guard_motorista_intake on public.automacoes;
create trigger trg_automacoes_guard_motorista_intake
  before insert or update of motorista_intake_destino, tipo
  on public.automacoes
  for each row
  execute function public.automacoes_guard_motorista_intake_destino();

drop policy if exists solicitacoes_motoristas_select_scope on public.solicitacoes_motoristas;

create policy solicitacoes_motoristas_select_scope
  on public.solicitacoes_motoristas
  for select
  to authenticated
  using (
    public.is_admin_master((select auth.uid()))
    or (
      user_id is not null
      and user_id = (select auth.uid())
      and status = 'cadastrado'
    )
    or (
      portal_auth_user_id is not null
      and portal_auth_user_id = (select auth.uid())
    )
    or (
      user_id is not null
      and user_id = (select auth.uid())
      and status is distinct from 'cadastrado'
      and motorista_intake_destino = 'frota_parceiros'
    )
  );

comment on policy solicitacoes_motoristas_select_scope on public.solicitacoes_motoristas is
  'Admin: tudo. Dono da frota: cadastrados + leads em aberto só se motorista_intake_destino = frota_parceiros. Portal: linha com portal_auth_user_id.';

drop policy if exists solicitacoes_motoristas_update_scope on public.solicitacoes_motoristas;

create policy solicitacoes_motoristas_update_scope
  on public.solicitacoes_motoristas
  for update
  to authenticated
  using (
    public.is_admin_master((select auth.uid()))
    or (
      user_id is not null
      and user_id = (select auth.uid())
      and status = 'cadastrado'
    )
    or (
      user_id is not null
      and user_id = (select auth.uid())
      and status is distinct from 'cadastrado'
      and motorista_intake_destino = 'frota_parceiros'
    )
  )
  with check (
    public.is_admin_master((select auth.uid()))
    or (
      user_id is not null
      and user_id = (select auth.uid())
      and status = 'cadastrado'
    )
    or (
      user_id is not null
      and user_id = (select auth.uid())
      and status is distinct from 'cadastrado'
      and motorista_intake_destino = 'frota_parceiros'
    )
  );

comment on policy solicitacoes_motoristas_update_scope on public.solicitacoes_motoristas is
  'Admin: qualquer linha. Dono: cadastrados ou leads frota_parceiros em aberto.';
