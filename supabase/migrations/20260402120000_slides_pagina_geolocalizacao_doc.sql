-- Slides: valor de pagina "geolocalizacao" — carrossel no menu Geolocalização (motorista executivo).
-- A coluna já é text; sem alteração de schema. Documentação para operação e futuras políticas RLS.
comment on column public.slides.pagina is
  'Área do sistema: home, home_taxi, geolocalizacao, google, email_business, website, disparador, mentoria, empty_legs, etc.';
