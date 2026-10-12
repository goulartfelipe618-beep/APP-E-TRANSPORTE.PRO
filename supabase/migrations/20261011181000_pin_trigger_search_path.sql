-- Fixa search_path nas funções apontadas pelo advisor.
-- Cada uma só usa objetos de public ou funções do catálogo (now, radians, nextval).
-- Não altera dados nem a lógica. Reversão: ALTER FUNCTION ... RESET search_path;

ALTER FUNCTION public.touch_updated_at() SET search_path TO public;
ALTER FUNCTION public.prevent_active_campaign_delete() SET search_path TO public;
ALTER FUNCTION public.rastreios_ao_vivo_set_updated_at() SET search_path TO public;
ALTER FUNCTION public.touch_veiculos_frota_updated_at() SET search_path TO public;
ALTER FUNCTION public.haversine_km(double precision, double precision, double precision, double precision) SET search_path TO public;
ALTER FUNCTION public._financial_status_cancelled(text) SET search_path TO public;
ALTER FUNCTION public.trg_financial_transactions_update_guard() SET search_path TO public;
ALTER FUNCTION public._reserva_status_concluida(text) SET search_path TO public;
ALTER FUNCTION public.catalogos_motorista_touch_updated_at() SET search_path TO public;
ALTER FUNCTION public.generate_unique_ticket_code() SET search_path TO public;
ALTER FUNCTION public.set_ticket_code_before_insert() SET search_path TO public;
