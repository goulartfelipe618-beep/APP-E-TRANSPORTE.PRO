-- Incluir ou omitir o bloco de contrato no PDF de confirmação (Transfer / Grupos), por linha em public.contratos.
alter table public.contratos
  add column if not exists incluir_no_pdf_confirmacao boolean not null default true;

comment on column public.contratos.incluir_no_pdf_confirmacao is
  'Quando true, as páginas de contrato entram no mesmo PDF da confirmação da reserva.';
