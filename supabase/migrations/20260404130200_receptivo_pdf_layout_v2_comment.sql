-- PDF de receptivo: layout (tamanho da logo, posição do nome) é gerado no cliente (src/lib/receptivoTransferPdf.ts).
-- Esta tabela guarda histórico; não há colunas de layout. Documentação da versão visual atual:
comment on table public.receptivos is
  'Plaquinhas de receptivo (Transfer); PDF gerado no cliente. Layout v2: logo ampliada (~4×, limitada à folha) e nome do cliente mais abaixo. Código: src/lib/receptivoTransferPdf.ts.';
