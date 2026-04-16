-- URL pública da imagem de capa do veículo (1220×880 px) para exibição em cards.
alter table public.veiculos_frota
  add column if not exists imagem_capa_url text null;

comment on column public.veiculos_frota.imagem_capa_url is
  'Imagem de capa do veículo (recomendado 1220×880 px) para listagem em cards.';
