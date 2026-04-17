-- Refina as políticas RLS de rastreios_ao_vivo:
--   • Apenas o motorista (user_id = auth.uid()) pode ATUALIZAR / INSERIR a sua corrida.
--   • Central/Admin (is_platform_staff) tem LEITURA (SELECT) e DELETE (emergência/limpeza);
--     NUNCA escreve posição pelo cliente — se precisar forçar algo, usar service_role em
--     edge function (bypassa RLS).
--   • Cliente vinculado (não autenticado) lê via RPC pública get_rastreio_publico(token)
--     — a policy de authenticated NÃO o cobre; o RPC tem SECURITY DEFINER para isso.
--
-- Em rastreios_ao_vivo_pontos aplica-se a mesma lógica: só o motorista dono do rastreio
-- pai insere/lê/delete; staff pode ler (auditoria).

-- ------------------------------------------------
-- rastreios_ao_vivo
-- ------------------------------------------------
drop policy if exists rastreios_ao_vivo_select_own   on public.rastreios_ao_vivo;
drop policy if exists rastreios_ao_vivo_insert_own   on public.rastreios_ao_vivo;
drop policy if exists rastreios_ao_vivo_update_own   on public.rastreios_ao_vivo;
drop policy if exists rastreios_ao_vivo_delete_own   on public.rastreios_ao_vivo;

-- SELECT: motorista dono OU Central/Admin
create policy rastreios_ao_vivo_select_motorista_ou_staff
  on public.rastreios_ao_vivo for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_platform_staff()
  );

-- INSERT: somente motorista cria a sua corrida
create policy rastreios_ao_vivo_insert_motorista
  on public.rastreios_ao_vivo for insert to authenticated
  with check (user_id = (select auth.uid()));

-- UPDATE: somente motorista (incluindo encerrar) — staff não escreve daqui
create policy rastreios_ao_vivo_update_motorista
  on public.rastreios_ao_vivo for update to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- DELETE: motorista dono OU staff (manutenção)
create policy rastreios_ao_vivo_delete_motorista_ou_staff
  on public.rastreios_ao_vivo for delete to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_platform_staff()
  );

-- ------------------------------------------------
-- rastreios_ao_vivo_pontos
-- ------------------------------------------------
drop policy if exists rastreios_ao_vivo_pontos_select_own on public.rastreios_ao_vivo_pontos;
drop policy if exists rastreios_ao_vivo_pontos_insert_own on public.rastreios_ao_vivo_pontos;
drop policy if exists rastreios_ao_vivo_pontos_delete_own on public.rastreios_ao_vivo_pontos;

-- SELECT: motorista dono do rastreio pai OU staff
create policy rastreios_ao_vivo_pontos_select_motorista_ou_staff
  on public.rastreios_ao_vivo_pontos for select to authenticated
  using (
    exists (
      select 1 from public.rastreios_ao_vivo r
       where r.id = rastreios_ao_vivo_pontos.rastreio_id
         and (r.user_id = (select auth.uid()) or public.is_platform_staff())
    )
  );

-- INSERT: somente motorista dono grava breadcrumbs
create policy rastreios_ao_vivo_pontos_insert_motorista
  on public.rastreios_ao_vivo_pontos for insert to authenticated
  with check (
    exists (
      select 1 from public.rastreios_ao_vivo r
       where r.id = rastreios_ao_vivo_pontos.rastreio_id
         and r.user_id = (select auth.uid())
    )
  );

-- DELETE: motorista dono OU staff (limpeza manual). A limpeza automática pós-encerramento
-- ocorre via trigger SECURITY DEFINER e não depende desta policy.
create policy rastreios_ao_vivo_pontos_delete_motorista_ou_staff
  on public.rastreios_ao_vivo_pontos for delete to authenticated
  using (
    exists (
      select 1 from public.rastreios_ao_vivo r
       where r.id = rastreios_ao_vivo_pontos.rastreio_id
         and (r.user_id = (select auth.uid()) or public.is_platform_staff())
    )
  );

-- ------------------------------------------------
-- Defesa em profundidade: trigger BEFORE UPDATE que veta alteração de lat/lng por não-owner
-- (caso algum dia alguém crie uma policy mais laxa, a integridade da regra continua intacta).
-- ------------------------------------------------
create or replace function public.rastreios_somente_dono_mexe_posicao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();

  -- service_role / jobs (sem JWT) passam livremente
  if v_uid is null then
    return new;
  end if;

  -- O próprio dono pode tudo
  if new.user_id = v_uid then
    return new;
  end if;

  -- Qualquer outro (mesmo staff) não pode alterar campos de posição
  if (new.latitude   is distinct from old.latitude)
  or (new.longitude  is distinct from old.longitude)
  or (new.heading    is distinct from old.heading)
  or (new.speed_kmh  is distinct from old.speed_kmh)
  or (new.accuracy_m is distinct from old.accuracy_m)
  then
    raise exception
      'Apenas o motorista dono da corrida pode atualizar a localização em tempo real.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rastreios_somente_dono_mexe_posicao on public.rastreios_ao_vivo;
create trigger trg_rastreios_somente_dono_mexe_posicao
  before update on public.rastreios_ao_vivo
  for each row
  execute function public.rastreios_somente_dono_mexe_posicao();
