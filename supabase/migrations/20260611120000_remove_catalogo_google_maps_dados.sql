-- Painel motorista: produtos Catálogo (PDF) e Google Maps descontinuados — limpa dados associados.
-- Não remove migrações nem buckets legados (evita quebrar histórico); apenas linhas de dados.

delete from public.slides
where pagina in ('google', 'catalogo');

delete from public.catalogos_motorista;
