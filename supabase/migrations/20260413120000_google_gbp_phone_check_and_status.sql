-- Status para quando o Google exige verificação adicional (ex.: vídeo) antes de publicar o perfil.
alter table public.solicitacoes_servicos
  drop constraint if exists solicitacoes_servicos_status_check;

alter table public.solicitacoes_servicos
  add constraint solicitacoes_servicos_status_check
  check (
    status = any (
      array[
        'pendente',
        'em_andamento',
        'concluido',
        'recusado',
        'publicado',
        'pendente_verificacao'
      ]::text[]
    )
  );

comment on constraint solicitacoes_servicos_status_check on public.solicitacoes_servicos is
  'pendente_verificacao: Google Business Profile aguardando verificação (ex. vídeo).';

/**
 * Garante que o telefone não esteja em uso por outro motorista (configurações ou outra solicitação Google ativa).
 * Normaliza para apenas dígitos (BR: mínimo 10).
 */
create or replace function public.motorista_telefone_disponivel_para_google(p_user_id uuid, p_telefone text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  norm text;
  tel_cfg text;
  tel_json text;
begin
  norm := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  if length(norm) < 10 then
    return false;
  end if;

  for tel_cfg in
    select regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g')
    from public.configuracoes c
    where c.user_id is not null
      and c.user_id <> p_user_id
      and c.telefone is not null
      and length(regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g')) >= 10
  loop
    if tel_cfg = norm then
      return false;
    end if;
  end loop;

  for tel_json in
    select regexp_replace(
      coalesce(
        nullif(trim(s.dados_solicitacao->>'primary_phone'), ''),
        nullif(trim(s.dados_solicitacao->>'telefone'), ''),
        nullif(trim(s.dados_solicitacao->>'whatsapp'), ''),
        ''
      ),
      '\D',
      '',
      'g'
    )
    from public.solicitacoes_servicos s
    where s.tipo_servico = 'google'
      and s.user_id <> p_user_id
      and s.status <> 'recusado'
  loop
    if length(tel_json) >= 10 and tel_json = norm then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.motorista_telefone_disponivel_para_google(uuid, text) from public;
grant execute on function public.motorista_telefone_disponivel_para_google(uuid, text) to authenticated;
grant execute on function public.motorista_telefone_disponivel_para_google(uuid, text) to service_role;
