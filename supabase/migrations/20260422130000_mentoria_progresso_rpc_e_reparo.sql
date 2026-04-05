-- Reparo: alguns ambientes criaram mentoria_progresso sem user_id ou com usuario_id.
-- RPC evita GET com ?user_id=eq... (PostgREST pode retornar 400 se a coluna não bate com o cache).

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'mentoria_progresso'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'mentoria_progresso' and column_name = 'usuario_id'
    ) and not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'mentoria_progresso' and column_name = 'user_id'
    ) then
      alter table public.mentoria_progresso rename column usuario_id to user_id;
    end if;
  end if;
end $$;

-- Colunas esperadas pelo app (tabela pré-existente pode estar incompleta).
alter table public.mentoria_progresso add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.mentoria_progresso add column if not exists card_id uuid references public.mentoria_cards (id) on delete cascade;
alter table public.mentoria_progresso add column if not exists concluido boolean not null default false;
alter table public.mentoria_progresso add column if not exists concluido_em timestamptz;
alter table public.mentoria_progresso add column if not exists created_at timestamptz not null default now();

-- Leitura de progresso só do usuário logado; não depende de filtro na URL REST.
create or replace function public.get_my_mentoria_progress()
returns table (card_id uuid, concluido boolean)
language sql
stable
security definer
set search_path = public
as $$
  select mp.card_id, mp.concluido
  from public.mentoria_progresso mp
  where mp.user_id = (select auth.uid());
$$;

comment on function public.get_my_mentoria_progress() is
  'Progresso de mentoria do usuário atual. Usar no app em vez de GET mentoria_progresso?user_id=eq para evitar 400.';

revoke all on function public.get_my_mentoria_progress() from public;
grant execute on function public.get_my_mentoria_progress() to authenticated;
