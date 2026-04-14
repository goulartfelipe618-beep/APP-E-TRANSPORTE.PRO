-- Permite ao admin master ocultar a página Comunicador (Evolution) no painel dos motoristas executivos.

alter table public.comunicadores_evolution
  add column if not exists painel_motorista_evolution_ativo boolean not null default true;

comment on column public.comunicadores_evolution.painel_motorista_evolution_ativo is
  'Só aplica ao escopo sistema: se false, motoristas não veem o item Comunicador nem a página (Evolution próprio + referência oficial).';
