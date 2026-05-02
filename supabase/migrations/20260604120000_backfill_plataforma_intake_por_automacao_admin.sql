-- Corrige filas antigas: leads da landing gravados com automação cujo dono é admin_master
-- devem contar como plataforma_landing (só Admin Master vê em aberto).

update public.solicitacoes_motoristas sm
set motorista_intake_destino = 'plataforma_landing'
from public.automacoes a
where (sm.dados_webhook->>'_webhook_automacao_id') = a.id::text
  and a.tipo = 'motorista'
  and sm.status is distinct from 'cadastrado'
  and sm.motorista_intake_destino is distinct from 'plataforma_landing'
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = a.user_id
      and ur.role = 'admin_master'
  );
