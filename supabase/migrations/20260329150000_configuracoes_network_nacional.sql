-- Preferências do Network Nacional (Motorista Executivo), espelhando localStorage no servidor.
alter table public.configuracoes
  add column if not exists network_nacional_aceito text
    check (network_nacional_aceito is null or network_nacional_aceito in ('sim', 'nao'));

alter table public.configuracoes
  add column if not exists network_saida_data timestamptz null;

alter table public.configuracoes
  add column if not exists network_highlight_shown boolean not null default false;

comment on column public.configuracoes.network_nacional_aceito is 'Participação no Network Nacional: sim, nao ou null (ainda não respondeu).';
comment on column public.configuracoes.network_saida_data is 'Data em que o motorista saiu do Network (cooldown 60 dias).';
comment on column public.configuracoes.network_highlight_shown is 'Se o onboarding do menu Network (spotlight) já foi concluído.';
