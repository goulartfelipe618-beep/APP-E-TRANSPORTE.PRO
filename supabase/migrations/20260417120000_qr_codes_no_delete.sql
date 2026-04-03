-- QR Codes são permanentes: usuários autenticados não podem excluir registros próprios.

drop policy if exists "qr_codes_delete_own" on public.qr_codes;

comment on table public.qr_codes is 'QR Codes permanentes por usuário (marketing). Exclusão via cliente não permitida por RLS.';
