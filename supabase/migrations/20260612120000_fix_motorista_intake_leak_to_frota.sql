-- Corrige leads que caíram em Motoristas → Solicitações de um operador sem serem
-- candidatos explícitos ao webhook da frota (faltava X-Frota-Motorista-Intake na Edge).

update public.solicitacoes_motoristas sm
set motorista_intake_destino = 'plataforma_landing'
where sm.motorista_intake_destino = 'frota_parceiros'
  and sm.status is distinct from 'cadastrado'
  and sm.lead_user_id is not null
  and coalesce(sm.dados_webhook->>'_intake_frota_header_ok', '') is distinct from 'true';

-- Coerência: marca explícita de landing da plataforma
update public.solicitacoes_motoristas sm
set motorista_intake_destino = 'plataforma_landing'
where coalesce(sm.dados_webhook->>'_platform_landing_intake', '') = 'true'
  and sm.motorista_intake_destino is distinct from 'plataforma_landing';
