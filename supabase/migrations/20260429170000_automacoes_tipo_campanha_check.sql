-- Garantir que automações de campanha (webhook) aceitam tipo = 'campanha'.
-- Sem isto, o insert em `automacoes` com tipo campanha pode devolver 400 (check constraint).

do $$
declare
  cname text;
  def text;
begin
  for cname, def in
    select c.conname::text, pg_get_constraintdef(c.oid)::text
    from pg_constraint c
    join pg_class cl on c.conrelid = cl.oid
    join pg_namespace n on cl.relnamespace = n.oid
    where n.nspname = 'public'
      and cl.relname = 'automacoes'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%tipo%'
  loop
    if def ilike '%campanha%' then
      continue;
    end if;
    execute format('alter table public.automacoes drop constraint %I', cname);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class cl on c.conrelid = cl.oid
    join pg_namespace n on cl.relnamespace = n.oid
    where n.nspname = 'public'
      and cl.relname = 'automacoes'
      and c.contype = 'c'
      and c.conname = 'automacoes_tipo_inclui_campanha'
  ) then
    alter table public.automacoes
      add constraint automacoes_tipo_inclui_campanha
      check (tipo in ('transfer', 'motorista', 'grupo', 'campanha'));
  end if;
end $$;
