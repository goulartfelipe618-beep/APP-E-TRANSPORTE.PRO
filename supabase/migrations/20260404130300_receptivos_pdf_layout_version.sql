-- Versão do layout do PDF (logo/nome) persistida por linha; alinhada a RECEPTIVO_PDF_LAYOUT_VERSION em src/lib/receptivoTransferPdf.ts
alter table public.receptivos
  add column if not exists receptivo_pdf_layout_version text;

update public.receptivos
set receptivo_pdf_layout_version = 'v1'
where receptivo_pdf_layout_version is null;

alter table public.receptivos
  alter column receptivo_pdf_layout_version set default 'v2',
  alter column receptivo_pdf_layout_version set not null;

comment on column public.receptivos.receptivo_pdf_layout_version is
  'Layout do PDF no cliente: v1 legado; v2 logo ampliada (~4×) e nome mais abaixo. Constante RECEPTIVO_PDF_LAYOUT_VERSION em receptivoTransferPdf.ts.';
