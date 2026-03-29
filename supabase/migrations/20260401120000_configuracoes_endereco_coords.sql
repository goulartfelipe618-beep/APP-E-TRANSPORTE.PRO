-- Coordenadas do endereço em Meu Perfil (geocodificação Mapbox) para o mapa de Abrangência do Admin Master.
alter table public.configuracoes
  add column if not exists endereco_latitude double precision,
  add column if not exists endereco_longitude double precision;

comment on column public.configuracoes.endereco_latitude is 'Latitude WGS84 do endereço completo (Meu Perfil / Mapbox).';
comment on column public.configuracoes.endereco_longitude is 'Longitude WGS84 do endereço completo (Meu Perfil / Mapbox).';
