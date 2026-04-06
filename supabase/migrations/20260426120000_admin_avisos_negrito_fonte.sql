-- Família tipográfica por aviso. Negrito no texto via **trecho** no próprio campo `texto`.

alter table public.admin_avisos_plataforma
  add column if not exists fonte text not null default 'padrao';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'admin_avisos_plataforma_fonte_check'
  ) then
    alter table public.admin_avisos_plataforma
      add constraint admin_avisos_plataforma_fonte_check
      check (fonte in ('padrao', 'serif', 'mono', 'arredondada'));
  end if;
end $$;

comment on column public.admin_avisos_plataforma.fonte is
  'Família tipográfica apenas para este aviso: padrao, serif, mono, arredondada.';
