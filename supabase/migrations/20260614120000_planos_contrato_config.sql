-- Contrato global exibido na página "Planos" do painel admin_transfer.
-- Não guarda dados de utilizadores; todos os usuários autenticados leem o mesmo contrato ativo.
-- Edição fica restrita ao admin_master via RLS.

create table if not exists public.planos_contrato_config (
  id smallint primary key default 1,
  titulo text not null default 'Contrato de Assinatura dos Planos E-Transporte.pro',
  versao text not null default '1.0',
  conteudo text not null default '',
  ativo boolean not null default true,
  vigencia_inicio date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planos_contrato_config_singleton check (id = 1),
  constraint planos_contrato_config_titulo_len check (char_length(titulo) between 3 and 180),
  constraint planos_contrato_config_versao_len check (char_length(versao) between 1 and 40),
  constraint planos_contrato_config_conteudo_len check (char_length(conteudo) between 20 and 30000)
);

comment on table public.planos_contrato_config is
  'Contrato global exibido na página Planos do painel admin_transfer; leitura autenticada e edição apenas por admin_master.';

alter table public.planos_contrato_config enable row level security;

drop policy if exists planos_contrato_config_select_authenticated on public.planos_contrato_config;
create policy planos_contrato_config_select_authenticated
  on public.planos_contrato_config
  for select
  to authenticated
  using (ativo = true or public.is_admin_master((select auth.uid())));

drop policy if exists planos_contrato_config_insert_admin_master on public.planos_contrato_config;
create policy planos_contrato_config_insert_admin_master
  on public.planos_contrato_config
  for insert
  to authenticated
  with check (public.is_admin_master((select auth.uid())));

drop policy if exists planos_contrato_config_update_admin_master on public.planos_contrato_config;
create policy planos_contrato_config_update_admin_master
  on public.planos_contrato_config
  for update
  to authenticated
  using (public.is_admin_master((select auth.uid())))
  with check (public.is_admin_master((select auth.uid())));

drop policy if exists planos_contrato_config_delete_admin_master on public.planos_contrato_config;
create policy planos_contrato_config_delete_admin_master
  on public.planos_contrato_config
  for delete
  to authenticated
  using (public.is_admin_master((select auth.uid())));

grant select on public.planos_contrato_config to authenticated;
grant insert, update, delete on public.planos_contrato_config to authenticated;

insert into public.planos_contrato_config (id, titulo, versao, conteudo, ativo, vigencia_inicio)
values (
  1,
  'Contrato de Assinatura dos Planos E-Transporte.pro',
  '1.0',
  '1. OBJETO
1.1. Este contrato define as condições de uso dos planos FREE, STANDART e PRÓ da plataforma E-Transporte.pro.
1.2. O plano contratado determina os módulos, limites operacionais, automações, integrações e recursos comerciais disponíveis no painel do usuário.

2. PLANOS E ABRANGÊNCIA
2.1. O plano FREE permite utilização inicial da plataforma com limites operacionais de reservas, cadastros e geolocalização.
2.2. O plano STANDART remove os principais limites operacionais e libera contratos, campanhas e recursos comerciais essenciais.
2.3. O plano PRÓ é o plano máximo da plataforma, incluindo os recursos do STANDART, solicitações, mini painel do motorista, presença digital, domínios, e-mail business, website, automações e integrações premium.

3. ATIVAÇÃO, PAGAMENTO E ALTERAÇÃO DE PLANO
3.1. A ativação de plano pago ocorre após confirmação do pagamento pela Stripe ou confirmação administrativa.
3.2. Upgrades podem liberar recursos imediatamente após a confirmação. Downgrades ou cancelamentos podem suspender recursos premium no término ou interrupção do plano pago.
3.3. A plataforma pode ajustar módulos e nomes comerciais para evolução do produto, preservando o acesso ao conjunto contratado equivalente.

4. DADOS E RETENÇÃO
4.1. A mudança, cancelamento ou expiração de plano não apaga os dados do usuário.
4.2. Quando um recurso premium fica indisponível por plano, os dados relacionados podem permanecer visíveis em modo restrito, bloqueado ou somente leitura até nova ativação.

5. USO RESPONSÁVEL
5.1. O usuário é responsável pelos dados inseridos no painel, pelas informações enviadas a clientes e motoristas e pelo cumprimento das leis aplicáveis ao seu negócio.
5.2. É proibido usar a plataforma para envio abusivo de mensagens, conteúdo ilegal, fraude, violação de privacidade ou qualquer prática que comprometa a segurança da plataforma.

6. SUPORTE E DISPONIBILIDADE
6.1. A plataforma emprega esforços razoáveis para manter a disponibilidade dos serviços, podendo realizar manutenções, melhorias e atualizações.
6.2. Integrações externas, como Stripe, provedores de e-mail, WhatsApp, domínios, mapas e automações, dependem também da disponibilidade e regras dos respetivos fornecedores.

7. ACEITE
7.1. Ao utilizar, assinar ou solicitar ativação de plano, o usuário declara ciência das condições deste contrato e dos limites do plano atualmente ativo em sua conta.',
  true,
  current_date
)
on conflict (id) do nothing;
