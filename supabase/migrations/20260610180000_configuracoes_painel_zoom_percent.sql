-- Zoom da área de conteúdo do painel (desktop): 70–100 %. Mobile mantém viewport fixo em index.html.
alter table public.configuracoes
  add column if not exists painel_zoom_percent integer;

update public.configuracoes
set painel_zoom_percent = 100
where painel_zoom_percent is null;

alter table public.configuracoes
  alter column painel_zoom_percent set default 100;

alter table public.configuracoes
  alter column painel_zoom_percent set not null;

alter table public.configuracoes
  drop constraint if exists configuracoes_painel_zoom_percent_check;

alter table public.configuracoes
  add constraint configuracoes_painel_zoom_percent_check
  check (painel_zoom_percent >= 70 and painel_zoom_percent <= 100);

comment on column public.configuracoes.painel_zoom_percent is
  'Escala percentual (70–100) aplicada à área principal do painel em desktop; preferência por utilizador (RLS em configuracoes).';
