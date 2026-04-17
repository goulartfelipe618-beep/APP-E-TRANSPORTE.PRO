-- Verificação final: confirma que o polimento de segurança foi aplicado.

do $$
declare
  v_count int;
begin
  -- 1) Policy de UPDATE deve ser só do dono (não pode haver is_platform_staff() no USING da UPDATE)
  select count(*) into v_count
    from pg_policies
   where schemaname = 'public'
     and tablename  = 'rastreios_ao_vivo'
     and cmd        = 'UPDATE';
  if v_count = 0 then
    raise exception 'Policy UPDATE em rastreios_ao_vivo não existe.';
  end if;

  if exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename  = 'rastreios_ao_vivo'
       and cmd        = 'UPDATE'
       and (qual ilike '%is_platform_staff%' or with_check ilike '%is_platform_staff%')
  ) then
    raise exception 'Policy UPDATE ainda inclui is_platform_staff — motorista deve ser o único a atualizar posição.';
  end if;

  -- 2) Policy INSERT deve ser só do dono
  if exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename  = 'rastreios_ao_vivo'
       and cmd        = 'INSERT'
       and (with_check ilike '%is_platform_staff%')
  ) then
    raise exception 'Policy INSERT ainda inclui is_platform_staff — apenas o motorista cria a sua corrida.';
  end if;

  -- 3) Trigger defensiva de escrita de posição instalada
  if not exists (
    select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'rastreios_ao_vivo'
       and t.tgname  = 'trg_rastreios_somente_dono_mexe_posicao'
       and not t.tgisinternal
  ) then
    raise exception 'Trigger defensiva trg_rastreios_somente_dono_mexe_posicao não está activa.';
  end if;

  raise notice 'Geolocalizador: polimento de segurança OK (RLS owner-only para UPDATE/INSERT + trigger defensiva).';
end
$$;
