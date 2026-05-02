-- A coluna em `automacoes` misturava conceitos: config Admin (campos) vs webhooks dos utilizadores.
-- A fila da landing da plataforma fica só na edge: segredo PLATFORM_MOTORISTA_LANDING_AUTOMACAO_ID.

drop trigger if exists trg_automacoes_guard_motorista_intake on public.automacoes;
drop function if exists public.automacoes_guard_motorista_intake_destino();

alter table public.automacoes
  drop constraint if exists automacoes_motorista_intake_destino_check;

alter table public.automacoes
  drop column if exists motorista_intake_destino;
