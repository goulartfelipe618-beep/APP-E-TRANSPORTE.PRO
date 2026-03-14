
-- Add sequential reservation numbers
CREATE SEQUENCE public.reservas_transfer_numero_seq START 1001;
CREATE SEQUENCE public.reservas_grupos_numero_seq START 2001;

ALTER TABLE public.reservas_transfer 
  ADD COLUMN numero_reserva integer NOT NULL DEFAULT nextval('public.reservas_transfer_numero_seq');

ALTER TABLE public.reservas_grupos 
  ADD COLUMN numero_reserva integer NOT NULL DEFAULT nextval('public.reservas_grupos_numero_seq');

-- Create unique index
CREATE UNIQUE INDEX idx_reservas_transfer_numero ON public.reservas_transfer(numero_reserva);
CREATE UNIQUE INDEX idx_reservas_grupos_numero ON public.reservas_grupos(numero_reserva);
