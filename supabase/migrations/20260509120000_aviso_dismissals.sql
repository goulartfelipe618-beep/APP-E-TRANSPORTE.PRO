-- Persistência do estado "Não mostrar novamente" (e snooze de 8h) dos avisos
-- de plataforma por utilizador. Anteriormente estava apenas em localStorage
-- — o que fazia o aviso reaparecer ao fazer login noutro browser/dispositivo
-- ou quando o storage era limpo (ITP no Safari iOS, antivírus, modo anónimo,
-- etc.).

create table if not exists public.aviso_dismissals (
  user_id uuid not null references auth.users(id) on delete cascade,
  aviso_id uuid not null references public.admin_avisos_plataforma(id) on delete cascade,
  permanent boolean not null default false,
  snooze_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, aviso_id)
);

comment on table public.aviso_dismissals is
  'Estado por utilizador × aviso: "Não mostrar novamente" (permanent) e snooze de 8h. Sincroniza o comportamento entre dispositivos.';

create index if not exists aviso_dismissals_user_id_idx
  on public.aviso_dismissals (user_id);

alter table public.aviso_dismissals enable row level security;

drop policy if exists "aviso_dismissals_select_own" on public.aviso_dismissals;
create policy "aviso_dismissals_select_own"
  on public.aviso_dismissals for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "aviso_dismissals_insert_own" on public.aviso_dismissals;
create policy "aviso_dismissals_insert_own"
  on public.aviso_dismissals for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "aviso_dismissals_update_own" on public.aviso_dismissals;
create policy "aviso_dismissals_update_own"
  on public.aviso_dismissals for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "aviso_dismissals_delete_own" on public.aviso_dismissals;
create policy "aviso_dismissals_delete_own"
  on public.aviso_dismissals for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.aviso_dismissals to authenticated;
