-- Leads em aberto com login (webhook motorista) que ficaram como frota_parceiros sem o carimbo
-- _intake_frota_header_ok eram cadastros na plataforma ou legado pré-header — não devem aparecer
-- em Motoristas → Solicitações do operador comum. Novos leads frota passam a gravar o carimbo na função webhook-solicitacao.

update public.solicitacoes_motoristas sm
set motorista_intake_destino = 'plataforma_landing'
where sm.motorista_intake_destino = 'frota_parceiros'
  and sm.status is distinct from 'cadastrado'
  and sm.lead_user_id is not null
  and coalesce(sm.dados_webhook->>'_intake_frota_header_ok', '') is distinct from 'true';
