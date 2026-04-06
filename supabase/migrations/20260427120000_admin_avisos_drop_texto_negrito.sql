-- Negrito passa a ser indicado no próprio texto com **trecho**; coluna boolean removida.

alter table public.admin_avisos_plataforma
  drop column if exists texto_negrito;
