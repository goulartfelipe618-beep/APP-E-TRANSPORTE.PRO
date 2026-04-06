-- Configuracoes da tela de login + destino de aviso para tela de login.

alter table public.admin_avisos_plataforma
  add column if not exists incluir_login boolean not null default false;

alter table public.admin_avisos_plataforma
  drop constraint if exists admin_avisos_plataforma_publico_check;

alter table public.admin_avisos_plataforma
  add constraint admin_avisos_plataforma_publico_check
  check (incluir_motorista = true or incluir_taxi = true or incluir_login = true);

create table if not exists public.login_painel_config (
  id int primary key default 1,
  imagem_lateral_url text,
  painel_titulo text not null default 'Painel E-Transporte.pro',
  painel_subtitulo text not null default 'Acesse com seguranca para gerir sua operacao.',
  form_titulo text not null default 'Faca seu login',
  form_legenda text not null default 'Use seu usuario e senha para entrar no painel.',
  placeholder_usuario text not null default 'Email ou usuario',
  placeholder_senha text not null default 'Senha',
  placeholder_captcha text not null default 'Digite o codigo acima',
  texto_esqueci_senha text not null default 'Esqueci minha senha',
  texto_botao_login text not null default 'Iniciar sessao',
  seguranca_titulo text not null default 'Checkup de seguranca',
  seguranca_itens text[] not null default array[
    'Nunca compartilhe sua senha com terceiros.',
    'Verifique o codigo de seguranca antes de entrar.',
    'Ative 2FA no menu Sistema > Configuracoes.'
  ],
  rodape_texto text not null default '© 2026 - Todos os direitos reservados.',
  texto_botao_ajuda text not null default 'Ajuda',
  idioma_padrao text not null default 'pt-BR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint login_painel_config_singleton check (id = 1)
);

insert into public.login_painel_config (id)
values (1)
on conflict (id) do nothing;

alter table public.login_painel_config enable row level security;

drop policy if exists login_painel_config_public_read on public.login_painel_config;
create policy login_painel_config_public_read
  on public.login_painel_config for select to anon, authenticated
  using (true);

drop policy if exists login_painel_config_insert_master on public.login_painel_config;
create policy login_painel_config_insert_master
  on public.login_painel_config for insert to authenticated
  with check (public.is_admin_master((select auth.uid())));

drop policy if exists login_painel_config_update_master on public.login_painel_config;
create policy login_painel_config_update_master
  on public.login_painel_config for update to authenticated
  using (public.is_admin_master((select auth.uid())))
  with check (public.is_admin_master((select auth.uid())));

drop policy if exists login_painel_config_delete_master on public.login_painel_config;
create policy login_painel_config_delete_master
  on public.login_painel_config for delete to authenticated
  using (public.is_admin_master((select auth.uid())));

grant select on public.login_painel_config to anon, authenticated;
grant insert, update, delete on public.login_painel_config to authenticated;

insert into storage.buckets (id, name, public)
values ('login-assets', 'login-assets', true)
on conflict (id) do nothing;

drop policy if exists login_assets_public_read on storage.objects;
create policy login_assets_public_read
on storage.objects for select to public
using (bucket_id = 'login-assets');

drop policy if exists login_assets_admin_insert on storage.objects;
create policy login_assets_admin_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'login-assets' and public.is_admin_master((select auth.uid())));

drop policy if exists login_assets_admin_update on storage.objects;
create policy login_assets_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'login-assets' and public.is_admin_master((select auth.uid())))
with check (bucket_id = 'login-assets' and public.is_admin_master((select auth.uid())));

drop policy if exists login_assets_admin_delete on storage.objects;
create policy login_assets_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'login-assets' and public.is_admin_master((select auth.uid())));
