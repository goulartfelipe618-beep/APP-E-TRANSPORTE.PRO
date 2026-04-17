-- Verificação de integridade do Geolocalizador.
-- Não cria nem altera objetos — apenas valida que o ambiente está
-- corretamente configurado (Realtime, triggers, RPCs, RLS e REPLICA IDENTITY).
-- Qualquer falha nestes ASSERT aborta a migração com uma mensagem clara.

do $$
declare
  v_count int;
  v_replica "char";
begin
  -- 1) Tabelas existem
  if not exists (
    select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rastreios_ao_vivo' and c.relkind = 'r'
  ) then
    raise exception 'Tabela public.rastreios_ao_vivo não existe.';
  end if;

  if not exists (
    select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rastreios_ao_vivo_pontos' and c.relkind = 'r'
  ) then
    raise exception 'Tabela public.rastreios_ao_vivo_pontos não existe.';
  end if;

  -- 2) RLS ligada em ambas
  if not exists (
    select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rastreios_ao_vivo' and c.relrowsecurity
  ) then
    raise exception 'RLS desligada em rastreios_ao_vivo.';
  end if;

  if not exists (
    select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'rastreios_ao_vivo_pontos' and c.relrowsecurity
  ) then
    raise exception 'RLS desligada em rastreios_ao_vivo_pontos.';
  end if;

  -- 3) Policies mínimas presentes
  select count(*) into v_count
    from pg_policies
   where schemaname = 'public' and tablename = 'rastreios_ao_vivo';
  if v_count < 4 then
    raise exception 'rastreios_ao_vivo: esperado >=4 policies (select/insert/update/delete), encontrado %.', v_count;
  end if;

  select count(*) into v_count
    from pg_policies
   where schemaname = 'public' and tablename = 'rastreios_ao_vivo_pontos';
  if v_count < 3 then
    raise exception 'rastreios_ao_vivo_pontos: esperado >=3 policies (select/insert/delete), encontrado %.', v_count;
  end if;

  -- 4) REPLICA IDENTITY FULL (para o Realtime receber a linha completa)
  select c.relreplident into v_replica
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'rastreios_ao_vivo';
  if v_replica is distinct from 'f' then
    raise exception 'rastreios_ao_vivo precisa de REPLICA IDENTITY FULL (atual: %).', v_replica;
  end if;

  select c.relreplident into v_replica
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'rastreios_ao_vivo_pontos';
  if v_replica is distinct from 'f' then
    raise exception 'rastreios_ao_vivo_pontos precisa de REPLICA IDENTITY FULL (atual: %).', v_replica;
  end if;

  -- 5) Publicação Realtime inclui ambas as tabelas
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'rastreios_ao_vivo'
  ) then
    raise exception 'rastreios_ao_vivo não está em supabase_realtime.';
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'rastreios_ao_vivo_pontos'
  ) then
    raise exception 'rastreios_ao_vivo_pontos não está em supabase_realtime.';
  end if;

  -- 6) Colunas de resumo existem
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'rastreios_ao_vivo'
       and column_name in (
         'origem_endereco','destino_endereco','valor_total',
         'distancia_total_km','duracao_segundos','data_hora_fim'
       )
    group by table_name
    having count(*) = 6
  ) then
    raise exception 'Colunas de resumo em rastreios_ao_vivo estão incompletas.';
  end if;

  -- 7) Funções de trigger e RPC existem
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'rastreios_antes_encerrar'
  ) then
    raise exception 'Função public.rastreios_antes_encerrar() não existe.';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'rastreios_apos_encerrar'
  ) then
    raise exception 'Função public.rastreios_apos_encerrar() não existe.';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'haversine_km'
  ) then
    raise exception 'Função public.haversine_km() não existe.';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'encerrar_rastreio'
  ) then
    raise exception 'RPC public.encerrar_rastreio() não existe.';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'get_rastreio_publico'
  ) then
    raise exception 'RPC public.get_rastreio_publico() não existe.';
  end if;

  -- 8) Triggers activas
  if not exists (
    select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'rastreios_ao_vivo'
       and t.tgname = 'trg_rastreios_antes_encerrar'
       and not t.tgisinternal
  ) then
    raise exception 'Trigger trg_rastreios_antes_encerrar não está activa.';
  end if;

  if not exists (
    select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'rastreios_ao_vivo'
       and t.tgname = 'trg_rastreios_apos_encerrar'
       and not t.tgisinternal
  ) then
    raise exception 'Trigger trg_rastreios_apos_encerrar não está activa.';
  end if;

  -- 9) Permissão de execução da RPC para authenticated
  if not has_function_privilege(
    'authenticated',
    'public.encerrar_rastreio(uuid, text, text, numeric, numeric, integer)',
    'EXECUTE'
  ) then
    raise exception 'Role authenticated não pode executar public.encerrar_rastreio.';
  end if;

  raise notice 'Geolocalizador: integridade OK (Realtime, triggers, RPC, RLS, REPLICA IDENTITY).';
end
$$;
