-- Onboarding motorista: redefinição de senha registada; cabeçalho contratual com/sem CNPJ próprio.

alter table public.configuracoes
  add column if not exists senha_redefinida_em timestamptz null;

comment on column public.configuracoes.senha_redefinida_em is
  'Preenchido quando o utilizador altera a senha em Sistema > Configurações (obrigatório no primeiro acesso).';

alter table public.cabecalho_contratual
  add column if not exists possui_cnpj text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'cabecalho_contratual' and c.conname = 'cabecalho_contratual_possui_cnpj_check'
  ) then
    alter table public.cabecalho_contratual
      add constraint cabecalho_contratual_possui_cnpj_check
      check (possui_cnpj is null or possui_cnpj in ('sim', 'nao'));
  end if;
end $$;

comment on column public.cabecalho_contratual.possui_cnpj is
  'sim: dados próprios no cabeçalho; nao: contratos usam dados do Meu Perfil.';

update public.cabecalho_contratual
set possui_cnpj = 'sim'
where possui_cnpj is null;

-- Contas já existentes: não exigir retroativamente troca de senha no primeiro deploy.
update public.configuracoes
set senha_redefinida_em = coalesce(senha_redefinida_em, now())
where senha_redefinida_em is null;
