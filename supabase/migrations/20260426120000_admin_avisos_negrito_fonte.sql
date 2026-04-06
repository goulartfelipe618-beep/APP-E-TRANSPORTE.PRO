-- Estilo por aviso: negrito e família tipográfica (apenas naquele aviso).

alter table public.admin_avisos_plataforma
  add column if not exists texto_negrito boolean not null default false;

alter table public.admin_avisos_plataforma
  add column if not exists fonte text not null default 'padrao';

alter table public.admin_avisos_plataforma
  add constraint admin_avisos_plataforma_fonte_check
  check (fonte in ('padrao', 'serif', 'mono', 'arredondada'));

comment on column public.admin_avisos_plataforma.texto_negrito is
  'Quando true, o texto do aviso é exibido em negrito no painel.';
comment on column public.admin_avisos_plataforma.fonte is
  'Família tipográfica apenas para este aviso: padrao, serif, mono, arredondada.';
