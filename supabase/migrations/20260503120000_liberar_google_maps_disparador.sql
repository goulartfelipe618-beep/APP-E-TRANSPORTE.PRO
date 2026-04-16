-- Libera consumo de Google Maps e Disparador no painel motorista (remove bloqueio BETA / construção).
update public.plataforma_ferramentas_disponibilidade
set
  google_maps_consumo_liberado = true,
  disparador_consumo_liberado = true,
  updated_at = now()
where id = 1;
