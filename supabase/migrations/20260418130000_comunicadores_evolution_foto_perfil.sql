-- Foto de perfil e nome exibidos após sincronizar com WhatsApp (Evolution).

alter table public.comunicadores_evolution
  add column if not exists foto_perfil_url text;

comment on column public.comunicadores_evolution.foto_perfil_url is 'URL da foto de perfil do WhatsApp (Evolution), após conexão.';
