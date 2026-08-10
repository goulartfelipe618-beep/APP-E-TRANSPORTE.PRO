-- Evita conflito UNIQUE em numero_reserva quando a sequência fica atrás do MAX
-- (ou desalinhada após deletes/rollbacks). Nunca reduz last_value.
SELECT setval(
  'public.reservas_transfer_numero_seq',
  GREATEST(
    COALESCE((SELECT MAX(numero_reserva) FROM public.reservas_transfer), 1),
    (SELECT last_value FROM public.reservas_transfer_numero_seq)
  ),
  true
);

SELECT setval(
  'public.reservas_grupos_numero_seq',
  GREATEST(
    COALESCE((SELECT MAX(numero_reserva) FROM public.reservas_grupos), 1),
    (SELECT last_value FROM public.reservas_grupos_numero_seq)
  ),
  true
);
