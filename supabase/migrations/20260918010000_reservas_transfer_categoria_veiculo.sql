-- Categoria de veículo no formulário de reserva transfer (legado permanece NULL).
-- Não alterar get_frota_motorista_reservas aqui: DROP+CREATE com coluna nova
-- apaga o RPC se o CREATE falhar e some as reservas no portal da frota.

ALTER TABLE public.reservas_transfer
  ADD COLUMN IF NOT EXISTS categoria_veiculo text;

ALTER TABLE public.reservas_transfer
  DROP CONSTRAINT IF EXISTS reservas_transfer_categoria_veiculo_check;

ALTER TABLE public.reservas_transfer
  ADD CONSTRAINT reservas_transfer_categoria_veiculo_check
  CHECK (
    categoria_veiculo IS NULL
    OR categoria_veiculo IN (
      'van',
      'micro_onibus',
      'veiculo_07_lugares',
      'mini_van',
      'sedan',
      'hatch',
      'onibus'
    )
  );

COMMENT ON COLUMN public.reservas_transfer.categoria_veiculo IS
  'Categoria do veículo da reserva: van, micro_onibus, veiculo_07_lugares, mini_van, sedan, hatch, onibus.';
