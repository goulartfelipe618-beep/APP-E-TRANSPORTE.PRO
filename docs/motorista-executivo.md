# Manual oficial — Painel do motorista executivo (E-Transporte.pro)

**Âmbito:** código da aplicação web em **`/dashboard`** (`DashboardLayout.tsx` + `AppSidebar.tsx` + `PAGE_MAP`).  
**Princípio:** só entra aquilo que **existe e pode ser verificado** no repositório; limitações e botões «mortos» são indicados explicitamente.

**Última revisão (auditoria):** verificação cruzada entre `PAGE_MAP` (35 chaves), `getMenuStructure` no `AppSidebar`, grelha da `Home.tsx` (`buildHomeSections`), e leitura dos ficheiros das páginas.

---

## Índice

1. [Visão geral](#1-visão-geral)  
2. [Principais vantagens para o motorista executivo](#2-principais-vantagens-para-o-motorista-executivo)  
3. [Inventário robusto — cobertura de navegação](#3-inventário-robusto--cobertura-de-navegação)  
4. [Acesso, sessão e segurança](#4-acesso-sessão-e-segurança)  
   - [4.4 Alinhamento com README_SECURITY](#44-alinhamento-com-readme-security)  
   - [4.5 Escala (1000+ motoristas, grandes volumes)](#45-escala-1000-motoristas-grandes-volumes)  
5. [Componentes globais do layout](#5-componentes-globais-do-layout)  
6. [Catálogo completo de ferramentas e funções](#6-catálogo-completo-de-ferramentas-e-funções)  
7. [Fluxos práticos](#7-fluxos-práticos)  
8. [Regras de negócio e permissões](#8-regras-de-negócio-e-permissões)  
9. [Boas práticas](#9-boas-práticas)  
10. [Erros, limitações e resolução](#10-erros-limitações-e-resolução)  
11. [Detalhes técnicos (alto nível)](#11-detalhes-técnicos-alto-nível)  
12. [Conclusão](#12-conclusão)

---

## 1. Visão geral

### 1.1 O que é

O **painel do motorista executivo** é a aplicação de **gestão de frota** E-Transporte.pro: operação de **Transfer** e **Grupos**, recrutamento e cadastro de **motoristas parceiros**, **marketing** (campanhas, receptivos, QR), **presença digital** (website, domínios, e-mail profissional, Google Business em BETA), **comunicação** (Comunidade, Network Nacional, Comunicador WhatsApp Evolution quando ativo), **mentoria**, **empty legs**, **tickets**, **automações/webhooks** e **configurações** da empresa.

- **Rota:** `/dashboard` (protegida por `ProtectedRoute`).  
- **Cabeçalho:** «E-Transporte.pro — Gestão de Frota».  
- **Sidebar:** nome do projeto (`config.nome_projeto`) + subtítulo «Gestão de Frota».

### 1.2 Quem utiliza

Utilizadores cujo destino após login **não** é `/admin` (`admin_master`) nem `/taxi` (`admin_taxi`). A decisão faz-se em `getPostLoginPath` → RPC `get_session_primary_role`, com fallback em `user_roles`.

### 1.3 O que **não** é este painel

- **`/taxi`:** painel do perfil **admin taxi** / operação taxista (outro layout, `TaxiSidebar`).  
- **`/admin`:** administração global **admin master**.

---

## 2. Principais vantagens para o motorista executivo

Estas vantagens derivam das capacidades **efetivamente implementadas** no código.

| Área | Vantagem |
|------|----------|
| **Operação Transfer / Grupos** | Pipeline completo: **solicitação → conversão em reserva → PDF → comunicação ao cliente (webhook)** sem sair do painel; contratos editáveis alimentam o **mesmo texto** dos PDFs de confirmação. |
| **Visibilidade geográfica** | Mapa de **abrangência** com PINs por reserva (Transfer + Grupos), distinção visual de serviços concluídos, geocodificação assistida. |
| **Automação** | Página **Automações** com mapeamento de campos de payload para destinos (Transfer, Grupo, Motorista, Campanha); testes de webhook; integração com criação de campanhas. |
| **Captação** | **Campanhas** com slug, datas, cor e **webhook automático** em `automacoes`; **Leads** com filtros e **exportação CSV real**. |
| **Marketing físico** | **Receptivos** em PDF A4 paisagem com dados da reserva opcional no rodapé; **QR Codes** persistidos em base de dados com exportação PNG (vários tamanhos e estilos). |
| **Marca e confiança** | **Website** (briefing extenso + templates), **Domínios** (compra, verificação RDAP .br no browser, estados), **E-mail Business** (wizard multi-passos, estados de solicitação, preços indicados no UI). |
| **Colaboração** | **Network** em tempo real (subscrição Supabase na tabela `network`); **Comunidade** com posts, média, menções, likes, comentários e **atualização em tempo real** nas tabelas `community_*`. |
| **Suporte e notas** | **Tickets** com tipologia e estados; **Anotações** persistidas por utilizador. |
| **Formação** | **Mentoria** com cartões `mentoria_cards`, vídeo, progresso em `mentoria_progresso` / RPC `get_my_mentoria_progress`. |
| **Oportunidades aéreas** | **Empty Legs** listados da tabela `empty_lags` com status `aprovado`. |
| **Mensagens em massa (BETA)** | **Disparador** com documentação de uso seguro e abertura da plataforma externa quando a flag `disparador_consumo_liberado` permitir. |
| **WhatsApp Evolution** | **Comunicador** com QR, polling de estado, sincronização via API server-side quando a feature global está ativa. |

---

## 3. Inventário robusto — cobertura de navegação

### 3.1 Lista canónica (`PAGE_MAP` em `DashboardLayout.tsx`)

Todas as chaves abaixo têm componente React associado. A ordem segue o código.

| `activePage` | Componente (ficheiro) |
|--------------|----------------------|
| `home` | `Home.tsx` |
| `atualizacoes` | `AtualizacoesPage.tsx` |
| `metricas` | `Metricas.tsx` |
| `abrangencia` | `MotoristaAbrangencia.tsx` |
| `transfer/solicitacoes` | `TransferSolicitacoes.tsx` |
| `transfer/reservas` | `TransferReservas.tsx` |
| `transfer/contrato` | `TransferContrato.tsx` |
| `transfer/geolocalizacao` | `TransferGeolocalizacao.tsx` |
| `grupos/solicitacoes` | `GruposSolicitacoes.tsx` |
| `grupos/reservas` | `GruposReservas.tsx` |
| `grupos/contrato` | `GruposContrato.tsx` |
| `motoristas/cadastros` | `MotoristaCadastros.tsx` |
| `motoristas/parcerias` | `MotoristaParcerias.tsx` |
| `motoristas/solicitacoes` | `MotoristaSolicitacoes.tsx` |
| `motoristas/agendamentos` | `MotoristaAgendamentos.tsx` |
| `veiculos` | `Veiculos.tsx` |
| `campanhas/ativos` | `CampanhasAtivos.tsx` |
| `campanhas/leads` | `CampanhasLeads.tsx` |
| `marketing/receptivos` | `MarketingReceptivos.tsx` |
| `marketing/qrcode` | `MarketingQRCode.tsx` |
| `network` | `NetworkPage.tsx` |
| `comunidade` | `CommunityPage.tsx` |
| `google` | `GooglePage.tsx` |
| `email-business` | `EmailBusinessPage.tsx` |
| `website` | `WebsitePage.tsx` |
| `dominios` | `DominiosPage.tsx` |
| `anotacoes` | `AnotacoesPage.tsx` |
| `sistema/configuracoes` | `SistemaConfiguracoes.tsx` |
| `sistema/automacoes` | `SistemaAutomacoes.tsx` |
| `sistema/comunicador` | `ComunicadorMotoristaExecutivo.tsx` |
| `tickets` | `TicketsPage.tsx` |
| `disparador` | `DisparadorPage.tsx` |
| `mentoria` | `MentoriaPage.tsx` |
| `empty-legs` | `EmptyLegsPage.tsx` |

**Total: 35 páginas mapeadas.**

### 3.2 Presença no menu lateral (`AppSidebar`)

| `activePage` | No menu? | Notas |
|--------------|----------|--------|
| Todas as de «Principal» exceto `motoristas/agendamentos` | Sim (submenus ou item simples) | Ver secção 3.3. |
| `motoristas/agendamentos` | **Não** | Só `PAGE_MAP`; utilizador não a encontra pelo sidebar. |
| `dominios` | Sim | Não aparece na grelha da Home `buildHomeSections` (omissão de UX). |
| `network` | **Condicional** | Só se `localStorage.network_nacional_aceito === "sim"`. |
| `sistema/comunicador` | **Condicional** | Só se `usePainelMotoristaEvolutionAtivo` → `painel_motorista_evolution_ativo !== false` na linha sistema de `comunicadores_evolution` (ou default ativo se não houver linha). |

### 3.3 Árvore do menu (resumo)

- **Principal → Painel:** Home, Abrangência, Atualizações, Métricas.  
- **Principal → Transfer:** Solicitações, Reservas, Contrato.  
- **Principal → Grupos:** Solicitações, Reservas, Contrato.  
- **Principal → Motoristas:** Cadastros, Parcerias, Solicitações.  
- **Principal (itens):** Veículos, Empty Legs, Mentoria.  
- **Ferramentas:** Campanhas (Ativos, Leads), Receptivos, QR Codes, [Network], Comunidade, E-mail Business, Website, Domínios.
- **BETA** (legenda amarela, como os outros grupos): Geolocalização, Google Maps, Disparador.  
- **Configurações → Sistema:** Configurações, Automações, [Comunicador].  
- **Configurações:** Anotações, Tickets.  
- **Rodapé:** Notificações (sem ação), tema claro/escuro, Sair.

### 3.4 Grelha da Home (`buildHomeSections`)

Inclui atalhos para a maior parte das ferramentas; **ausentes na grelha:** **Domínios** e **`motoristas/agendamentos`**. O utilizador deve usar a **sidebar** para Domínios.

---

## 4. Acesso, sessão e segurança

### 4.1 Entrada

- `/` → `/login`.  
- Formulário: email, senha, CAPTCHA (regenerável).  
- MFA: se AAL2 exigido → `/mfa` (TOTP 6 dígitos).  
- Pós-auth: `getPostLoginPath` → `/dashboard` para o perfil executivo.

### 4.2 Sessão

- Cliente Supabase: **PKCE**, **`sessionStorage`**, `autoRefreshToken`.  
- **24 horas** desde `setAuthStartedAt` (`authExpiry.ts`): `ProtectedRoute`, `AuthExpiryGuard`, e verificação ao visitar `/login` com sessão válida podem forçar **logout**.

### 4.3 «Esqueci minha senha»

- Hiperligação = **`mailto:suporte@e-transporte.pro`** (texto pode vir de `login_painel_config`).  
- **Sem** fluxo Supabase «Forgot password» embutido nesta UI.

### 4.4 Alinhamento com README_SECURITY

Este painel **não contradiz** o manual de segurança do repositório (`README_SECURITY.md`) nos pontos verificáveis a partir do código e da documentação. A segurança **efectiva** em produção (milhares de utilizadores, milhões de linhas) depende também de **RLS no Postgres**, **políticas de Storage**, **Edge Functions / API Node** e **exploração** — o frontend só aplica o que o servidor já autoriza.

| Regra em `README_SECURITY` | Situação no painel motorista executivo |
|--------------------------------|----------------------------------------|
| **JWT / sessão em `sessionStorage`**, sem gravar tokens manualmente em `localStorage` | Alinhado: cliente Supabase em `integrations/supabase/client.ts` com PKCE e `sessionStorage` (como descrito na secção 4.2). |
| **`authExpiry` (24 h)** | Alinhado: `ProtectedRoute`, `AuthExpiryGuard`, login — conforme `authExpiry.ts` referido na doc. |
| **`localStorage` só para preferências de UI**, não credenciais | Alinhado para as referências deste manual: Network Nacional (`network_nacional_aceito`, destaques), tema, navegação `etp_nav_dashboard` em `sessionStorage` — **não** são tokens. O handoff **`MOTORISTA_FROM_SOLICITACAO_KEY`** em `sessionStorage` transporta **dados de formulário**, não JWT. |
| **Uploads: `assertUploadMagicBytes` antes de Storage** | O manual de funcionalidades refere páginas que usam este padrão (`SistemaConfiguracoes`, `WebsitePage`, `CommunityFeed` para média, etc.). Qualquer **novo** upload deve seguir o mesmo fluxo descrito no README. |
| **Novas tabelas: RLS + `audit_rls_gaps.sql`** | O painel consome dados via Supabase; **a barreira de acesso é o RLS**. Consultas com `select("*")` no cliente **não contornam** RLS — devolvem só o permitido por política. Manter migrações e o script de auditoria é **obrigatório** para entrega a 1000+ motoristas. |
| **`isRlsOrPermissionError`** (tratar erros de permissão) | Padrão citado para áreas admin; nas páginas do motorista, erros Supabase devem continuar a ser tratados (toasts, listas vazias) sem expor detalhes internos ao utilizador final. |
| **Webhooks com HMAC / raw body (Node + Edge)** | Comunicações que saem do painel (ex. `dispatchComunicarWebhook`, webhooks de campanha) dependem da configuração em **Automações** e das funções servidor — alinhar com as secções «Webhooks» do README em qualquer alteração. |
| **API Node: Helmet, rate-limit, JWT middleware, allowlist de Origin** | Aplica-se ao `server/`; se o motorista usar apenas o cliente Supabase, estas camadas protegem rotas **adicionais** quando existirem. |
| **`npm run security-check` antes de deploy** | Executado na revisão: **exit code 0**. O relatório pode listar vulnerabilidades **moderate** (ex.: advisory do Vite em dev) que **não bloqueiam** o script — seguir evolução do `npm audit` e do README. |

**O que este documento *não* pode garantir por si:** ausência de fugas de RLS, configuração correcta de secrets (`WEBHOOK_INBOUND_HMAC_SECRET`, etc.), nem que todas as tabelas usadas pelo painel tenham políticas revistas — isso exige **revisão periódica** do repositório Supabase (migrações + `audit_rls_gaps.sql`).

### 4.5 Escala (1000+ motoristas, grandes volumes)

- **Segurança:** mil utilizadores ou milhões de registos **não alteram** as regras do README: cada linha continua a ser filtrada pelo **RLS** e pelo **papel** do utilizador. Aumenta a importância de **auditorias**, **monitorização de abuso** e **limites de taxa** nos endpoints que aceitam webhooks.  
- **Performance:** o código do painel já inclui padrões como **paginação** na Comunidade (`.range` + «Carregar mais»); outras listagens com `select("*")` sem paginação podem tornar-se lentas ou pesadas em rede — isso é **performance**, não uma violação do README, mas deve ser planeado em conjunto com índices SQL e paginação server-side.  
- **Operação:** MFA, políticas de palavra-passe no Supabase, backups e revisão de **Edge Functions** são decisões de **plataforma**, não só de UI.

**Conclusão desta verificação:** não foi encontrada **oposição directa** entre o conteúdo de `docs/motorista-executivo.md` e `README_SECURITY.md`. A entrega a **>1000 motoristas** exige tratar o README como **checklist obrigatório** em cada release, não apenas como referência.

---

## 5. Componentes globais do layout

| Componente | Função |
|------------|--------|
| `SidebarTrigger` + cabeçalho | Colapsar sidebar; título da aplicação. |
| `PainelAvisoBanner` | Avisos de `admin_avisos_plataforma` para `painel="motorista"` e, se não for global, filtro por `paginas_motorista`. |
| `FullscreenBannerOverlay` | Banners fullscreen configuráveis pelo admin para páginas do painel motorista. |
| `FloatingSupportChat` | Carrega o **widget Chatwoot** (SDK) uma vez; URL e token podem ser sobrescritos com `VITE_CHATWOOT_BASE_URL` e `VITE_CHATWOOT_WEBSITE_TOKEN`. |
| `PageLoader` | Contém a página ativa com transição de carregamento. |
| `ActivePageProvider` | Estado `activePage`; `storageKey="etp_nav_dashboard"` — última página pode ser restaurada no mesmo browser. |

---

## 6. Catálogo completo de ferramentas e funções

Cada subsecção segue o modelo: **objetivo**, **fontes de dados**, **ações da interface**, **vantagens**, **limitações / honestidade técnica**.

---

### 6.1 Home (`home`)

**Objetivo:** Ponto central com carrossel (`SlideCarousel` página `home`), atalhos para módulos, verificação de **«primeiros passos»**, e fluxo **Network Nacional** (aceitar termos, ler regras, sair com cooldown).

**Dados:** `configuracoes` e `cabecalho_contratual` (campos obrigatórios definidos no próprio `Home.tsx`); `localStorage` para estado do Network; evento `configuracoes-updated` para refrescar checks.

**Funções:** Cartões clicáveis que chamam `setActivePage`; secção Network com persistência via `persistNetworkAceitoSim` / `Nao` / `persistNetworkRetornoSolicitado`; texto institucional sobre padrão de serviço.

**Vantagens:** Visão única do que falta preencher para «compliance» de perfil; acesso rápido a qualquer módulo sem memorizar o menu.

**Limitações:** A grelha **não** lista Domínios nem Agendamentos.

---

### 6.2 Atualizações (`atualizacoes`)

**Objetivo:** Lista unificada por data das últimas **solicitações** de Transfer, Grupos e Motoristas.

**Dados:** `solicitacoes_transfer`, `solicitacoes_grupos`, `solicitacoes_motoristas` — `select *`, ordenação por `created_at`.

**Funções:** Botão atualizar; clicar num item navega para `transfer/solicitacoes`, `grupos/solicitacoes` ou `motoristas/solicitacoes`.

**Vantagens:** Uma só fila de «entrada» para a operação.

**Limitações:** Não substitui a gestão detalhada nas páginas de origem.

---

### 6.3 Métricas (`metricas`)

**Objetivo:** Painel visual de KPIs e gráficos.

**Dados:** **Nenhum** — valores e séries são **constantes no código** (`Metricas.tsx`).

**Funções:** Apenas visualização estática.

**Vantagens:** Estrutura de UI pronta para futura ligação a dados reais.

**Limitações:** **Não usar para decisões financeiras ou operacionais** até existir integração com Supabase ou BI.

---

### 6.4 Abrangência (`abrangencia`)

**Objetivo:** Mapa Leaflet com marcadores das reservas **Transfer** e **Grupos** do utilizador; lista de pendentes de geocodificação.

**Dados:** Preferencialmente RPC **`get_motorista_abrangencia_reservas`**; se falhar ou vazio, **fallback** com queries `reservas_transfer` e `reservas_grupos` com filtro `.or(motorista_id.eq.USER,user_id.eq.USER)` (lógica espelhada em funções `transferVisivelMotoristaExecutivo` / `grupoVisivelMotoristaExecutivo`). Geocodificação: lista interna + **Nominatim** com delays.

**Funções:** Atualizar mapa; popups com resumo; ícone verde com ✓ quando o `status` da reserva contém palavras-chave de conclusão (`concluí`, `finaliz`, etc.).

**Vantagens:** Ver **onde** a frota opera; identificar reservas sem coordenadas.

**Limitações:** Dependência de qualidade dos endereços e de serviços externos de geocodificação.

---

### 6.5 Transfer — Solicitações (`transfer/solicitacoes`)

**Objetivo:** Inbox de pedidos de transfer.

**Dados:** `solicitacoes_transfer` (`select *`, ordem `created_at` desc).

**Funções:** Atualizar; ver detalhe (`DetalhesSolicitacaoTransferSheet`); **converter** em reserva (`CriarReservaTransferDialog` com `solicitacao_id` — após criar, `status` da solicitação → **`convertida`**); **Comunicar** (`ComunicarDialog`, webhook `transfer_reserva` / PDF conforme dialog); gerar PDF de solicitação; botão **Exportar CSV** visível.

**Vantagens:** Fecho do ciclo solicitação → reserva com uma ação guiada.

**Limitações honestas:** O botão **«Exportar CSV» não tem `onClick` ligado** neste ficheiro — **não exporta** até ser implementado.

---

### 6.6 Transfer — Reservas (`transfer/reservas`)

**Objetivo:** Gestão das reservas confirmadas.

**Dados:** `reservas_transfer` (`select *`).

**Funções:** Criar reserva (`CriarReservaTransferDialog`); tabela com Nº, cliente, tipo (`somente_ida`, `ida_volta`, `por_hora`), trajeto, data, valor (BRL), status; ações: **ver** (`DetalhesReservaTransferSheet`), **comunicar** (webhook + PDF confirmação), **download PDF** (`generateTransferPDF`), **excluir** (delete Supabase + confirmação).

**Vantagens:** PDF e comunicação alinhados com a mesma linha de reserva.

**Limitações:** Apagar remove permanentemente o registo (mensagem de confirmação).

---

### 6.7 Transfer — Contrato (`transfer/contrato`)

**Objetivo:** Personalizar textos legais que entram no **PDF de confirmação** (páginas após a confirmação no mesmo A4).

**Dados:** Tabela **`contratos`**, chave `(user_id, tipo)` com `tipo = "transfer"` — campos `modelo_contrato`, `politica_cancelamento`, `clausulas_adicionais`.

**Funções:** `CabecalhoContratual` (dados da empresa no contrato); `ContratoComoPdfPreview`; três áreas de texto editável; **Salvar** (`upsert`).

**Vantagens:** Contrato e políticas alinhados ao que o cliente vê no PDF.

---

### 6.8 Transfer — Geolocalização (`transfer/geolocalizacao`)

**Objetivo:** Disparar **webhook** para criação de **link de rastreamento** (integração n8n / fluxo externo).

**Dados:** Lista `reservas_transfer` e `reservas_grupos` para seleção.

**Funções:** `SlideCarousel` página `geolocalizacao`; diálogo **Novo Link**: escolher reserva (Transfer ou Grupo), categoria `cliente` ou `motorista`, nome/telefone opcionais, observações; envia `dispatchComunicarWebhook("geolocalizacao", { evento: "criar_link_rastreamento", ... })` com snapshot da reserva e `motorista_painel` de `fetchMotoristaPainelSnapshot`.

**Vantagens:** Integração explícita com stack de automação já usada em «Comunicar».

**Limitações:** A UI diz que o envio depende do **Comunicador** configurado no admin; a secção «Links de Rastreamento» mostra sempre **«Nenhum link criado»** (sem lista vinda da API).

---

### 6.9 Grupos — Solicitações (`grupos/solicitacoes`)

**Objetivo:** Inbox de pedidos de transporte em grupo.

**Dados:** `solicitacoes_grupos`.

**Funções:** Igual ao Transfer: ver, comunicar, converter (`CriarReservaGrupoDialog`), PDF de solicitação; após reserva, `status` → **`convertida`**. Botão Exportar CSV **sem handler**.

**Vantagens:** Paridade com o produto Transfer.

**Limitações:** Export CSV não implementado no clique.

---

### 6.10 Grupos — Reservas (`grupos/reservas`)

**Objetivo:** Reservas de grupo.

**Dados:** `reservas_grupos`.

**Funções:** Paralelo ao Transfer: criar, ver, comunicar, PDF (`generateGrupoPDF`), excluir; labels de tipo de veículo (`van`, `micro_onibus`, `onibus`).

**Vantagens:** Gestão unificada de grupo com mesmo padrão de ações.

---

### 6.11 Grupos — Contrato (`grupos/contrato`)

**Objetivo:** Textos de contrato para **PDF de confirmação de grupo**.

**Dados:** `contratos` com `tipo = "grupos"`.

**Funções:** Igual estrutura à página Transfer-contrato.

---

### 6.12 Motoristas — Cadastros (`motoristas/cadastros`)

**Objetivo:** Lista de motoristas já **cadastrados** (ficha aprovada).

**Dados:** `solicitacoes_motoristas` com **`status === "cadastrado"`** apenas.

**Funções:** Pesquisa local; vista grelha/lista; **Novo motorista** (`CadastrarMotoristaDialog`); consumo de `sessionStorage` `MOTORISTA_FROM_SOLICITACAO_KEY` para pré-preencher quando se vem da conversão.

**Vantagens:** Base filtrada só de quem já está no estado operacional «cadastrado».

---

### 6.13 Motoristas — Solicitações (`motoristas/solicitacoes`)

**Objetivo:** Fila de candidatos a motorista parceiro.

**Dados:** `solicitacoes_motoristas` (todos os estados na lista).

**Funções:** Ver (`DetalhesSolicitacaoMotoristaSheet`); **Converter em cadastro** (guarda payload em `sessionStorage`, navega para `motoristas/cadastros`, abre dialog) — **desativado** se `status === "cadastrado"`; comunicar; PDF. Export CSV **sem handler**.

**Vantagens:** Ligação directa solicitação → wizard de cadastro completo.

---

### 6.14 Motoristas — Parcerias (`motoristas/parcerias`)

**Objetivo:** Cadastro de **empresas parceiras** com veículos e subparceiros.

**Dados:** **Apenas estado React** (`useState`) — **não há** `insert`/`select` Supabase no ficheiro. Ao recarregar a página, **perde-se** a lista salva apenas em memória.

**Funções:** Formulário multi-tab (Empresa, Documentos, Veículos, Subparceiros); validação mínima (Razão Social + CNPJ); grelha/lista local; export/import UI mencionado no código visual se existir.

**Vantagens:** Prototipo rico de formulário para demos ou planeamento offline.

**Limitações críticas:** **Sem persistência** no servidor nesta versão.

---

### 6.15 Motoristas — Agendamentos (`motoristas/agendamentos`)

**Objetivo:** UI de calendário mensal e mensagem «Nenhum agendamento encontrado».

**Dados:** **Nenhuma** integração com tabela — botões **Atualizar** e **Novo Agendamento** sem lógica Supabase.

**Funções:** Navegação de mês; legenda de cores (Agendado / Concluído / Cancelado) sem dados.

**Vantagens:** Placeholder de UX.

**Limitações:** **Módulo não operacional**; **sem entrada no menu lateral** — só acessível programaticamente ou por evolução futura da UI.

---

### 6.16 Veículos (`veiculos`)

**Objetivo:** Consulta unificada da frota.

**Dados:** **Nenhum** — KPIs fixos «0»; lista vazia estática.

**Funções:** Campos de filtro visuais sem estado.

**Vantagens:** Estrutura visual preparada.

**Limitações:** **Sem CRUD** nem query.

---

### 6.17 Empty Legs (`empty-legs`)

**Objetivo:** Mostrar ofertas **Empty Leg** aprovadas.

**Dados:** `empty_lags` com **`status === "aprovado"`**; ordenação `created_at` desc.

**Funções:** `SlideCarousel` página `empty_legs`; cartões com origem/destino, datas, observações; itens com `data_hora` passada aparecem **expirados** (opacidade, sem interação).

**Vantagens:** Canal de oportunidades aéreas com curadoria (aprovado).

**Limitações:** Só leitura; sem reserva no próprio ecrã.

---

### 6.18 Mentoria (`mentoria`)

**Objetivo:** Trilha de conteúdos sobre o sistema e matérias de desenvolvimento.

**Dados:** `mentoria_cards` (`ativo=true`, ordenado); progresso via RPC **`get_my_mentoria_progress`** ou tabela **`mentoria_progresso`**; `upsert` ao marcar concluído.

**Funções:** Cartões «sobre_sistema» e «conteudo»; vista de vídeo; marcar completo ao fim do vídeo.

**Vantagens:** Progresso persistido por utilizador.

---

### 6.19 Campanhas — Ativos (`campanhas/ativos`)

**Objetivo:** Criar e listar campanhas de marketing com **webhook** associado.

**Dados:** `campanhas`; ao criar, insere também em **`automacoes`** (`tipo: "campanha"`, `is_campaign_webhook: true`, `ativo: false` inicialmente). Job ao abrir: campanhas **ativas** com `data_fim` &lt; hoje → `status: "encerrada"` e **remove** `automacoes` ligadas.

**Funções:** Dialog de criação (nome, fonte, link, cor, datas, descrição, status); listagem com badges; remoção com cascata conforme implementado no resto do ficheiro.

**Vantagens:** Ligação directa campanha ↔ automação n8n.

**Limitações:** Requer configuração correcta de webhooks em **Automações** para o fluxo completo.

---

### 6.20 Campanhas — Leads (`campanhas/leads`)

**Objetivo:** Ver leads captados pelos webhooks de campanha.

**Dados:** `campanha_leads` com join `campanhas`; contagem de automações de campanha ativas.

**Funções:** Filtro por campanha; busca textual no **JSON** do payload; **Exportar CSV** (implementado: colunas campanha, slug, data, payload_json).

**Vantagens:** Exportação **real** para Excel/BI.

---

### 6.21 Marketing — Receptivos (`marketing/receptivos`)

**Objetivo:** Gerar **PDFs tipo plaquinha** (A4 paisagem) para receptivo; histórico persistido.

**Dados:** Tabela **`receptivos`**.

**Funções:** `NovoReceptivoDialog`; tabela com download novamente (`generateReceptivoTransferPdf` + dados do `ConfiguracoesContext`); eliminar registo.

**Vantagens:** Rodapé com endereços **só** se vincular reserva Transfer na criação (texto explicativo na própria página).

---

### 6.22 Marketing — QR Codes (`marketing/qrcode`)

**Objetivo:** Criar e gerir QR Codes com URL de destino.

**Dados:** Tabela de QR codes no Supabase (ver `MarketingQRCode.tsx` — campos `titulo`, `url_destino`, `slug`, `ativo`).

**Funções:** Validação URL `http(s)`; preview com `qrcode.react`; export PNG em tamanhos 512/1024/2048; esquemas claro/escuro; copiar link; abrir externo com validação de segurança (`assertSafeHttpUrlForNavigation`).

**Vantagens:** Activo profissional para materiais impressos.

---

### 6.23 Network (`network`)

**Objetivo:** Feed colaborativo entre motoristas (`NetworkCollaborationFeed`).

**Dados:** Tabela **`network`**; realtime `postgres_changes` no canal `network-collab-feed`.

**Funções:** Criar publicação (`CriarNetworkDialog`); filtros tipo/estado/cidade; apagar **só as próprias** (`allowModeratorDelete={false}` no painel motorista); refresh manual.

**Vantagens:** Atualizações **em tempo real**; visibilidade cruzada na plataforma (conforme copy da UI).

**Limitações:** Menu só aparece após aceitar Network Nacional na Home / políticas de `localStorage`.

---

### 6.24 Comunidade (`comunidade`)

**Objetivo:** Rede social interna (`CommunityFeed`; `panel` por defeito **`motorista`** — `CommunityPage` não passa prop, logo usa o default).

**Dados:** Tabelas `community_posts`, `community_post_*`, `community_categories`, perfis em `configuracoes`; **realtime** em várias tabelas; **paginação** de posts (`.range`, botão **Carregar mais**).

**Funções:** Posts, média, menções, likes, comentários, categorias, edição/remoção conforme regras no componente; carrossel `SlideCarousel` página `comunidade`.

**Vantagens:** Comunidade moderável; desempenho melhorado com carregamento progressivo de posts.

---

### 6.25 Google Maps / Google Business (`google`)

**Objetivo:** Gestão de presença Google (GBP), briefing, tabs de informação, horários, fotos, etc.

**Dados / gates:** `useUserPlan`, `usePlataformaFerramentasDisponibilidade` (`google_maps_consumo_liberado`); no menu, grupo **BETA** (legenda amarela).

**Funções:** Múltiplas áreas (ver `GooglePage.tsx` — dezenas de secções); `UpgradePlanDialog` quando aplicável.

**Vantagens:** Fluxo único para solicitação/gestão de perfil Google.

**Limitações:** Marcado **BETA**; dependência de plano e flags globais.

---

### 6.26 E-mail Business (`email-business`)

**Objetivo:** Wizard multi-etapas (Domínio → E-mail → Dados → Confirmação) para solicitar e-mail profissional; listagem de solicitações.

**Dados:** Tabelas de solicitação/listagem conforme `EmailBusinessPage.tsx`; integração com `usePurchasedDomains`; estados `pendente`, `em_andamento`, `concluido`, `publicado`, `recusado`.

**Funções:** Texto de preço no UI (**primeiro e-mail gratuito**, caixas adicionais **R$ 14,99/mês**); navegação para Domínios quando necessário.

**Vantagens:** Processo guiado com benefícios listados (autoridade, anti-spam, integração Google).

---

### 6.27 Website (`website`)

**Objetivo:** Briefing e configuração de **site institucional** (templates, serviços, frota, integrações, etc.).

**Dados:** Templates em base de dados; `useUserPlan`, `usePurchasedDomains`; fluxo longo (ficheiro >1000 linhas).

**Funções:** Validação de uploads (`assertUploadMagicBytes`); pré-visualização de template; estados de pedido semelhantes ao e-mail.

**Vantagens:** Site alinhado à identidade e ao plano.

**Limitações:** Complexidade elevada — seguir passos na própria UI.

---

### 6.28 Domínios (`dominios`)

**Objetivo:** Comprar/registar domínios na plataforma; verificar disponibilidade **.br** via **RDAP no browser** (comentário no código: evitar 403 de datacenter); estados `pendente`, `ativo`, `em_configuracao`, `cancelado`; custos comunicados no UI (**1 domínio gratuito**, **R$ 60** por domínio adicional conforme aviso na página).

**Dados:** `dominios_usuario`; edge functions / fluxos de confirmação no próprio ficheiro.

**Funções:** Diálogos multi-passo; confirmações com temporizador (`CONFIRM_LOCK_SECONDS`); tabela de domínios.

**Vantagens:** Fluxo técnico robusto para `.br`.

---

### 6.29 Anotações (`anotacoes`)

**Objetivo:** Notas pessoais da operação.

**Dados:** Tabela **`anotacoes`** (CRUD: listar, criar, editar, eliminar).

**Funções:** Pesquisa; dialog de edição; confirmação de remoção.

**Vantagens:** Persistência real por utilizador.

---

### 6.30 Sistema — Configurações (`sistema/configuracoes`)

**Objetivo:** Perfil da empresa, logo, morada (Mapbox se configurado), rede social, MFA, secção de login (admin), **Network Nacional** (sair / voltar com cooldown 60 dias), etc.

**Dados:** `configuracoes`, `cabecalho_contratual`, auth MFA, `persistNetworkSair` / `persistNetworkRetornoSolicitado`.

**Funções:** Upload com validação mágica de bytes; `LoginConfiguracoesSection` para admins; eventos globais para refrescar Home.

**Vantagens:** Um só sítio para dados que alimentam PDFs, receptivos e checks da Home.

---

### 6.31 Sistema — Automações (`sistema/automacoes`)

**Objetivo:** Configurar **webhooks** por tipo (Transfer, Motorista, Grupo, Campanha) com **mapeamento** de campos do payload JSON para campos internos; testes e histórico de testes; ferramentas dev.

**Dados:** `automacoes`, `automacoes_campos_config`, payloads de teste.

**Funções:** Copiar URL do projecto Supabase; ativar/desativar; mapeamento visual com selects baseados em chaves do último payload de teste; apagar automação/testes.

**Vantagens:** Base técnica para integrar site, landing pages e campanhas.

---

### 6.32 Sistema — Comunicador (`sistema/comunicador`)

**Objetivo:** Ligar instância **Evolution API** (WhatsApp) do motorista: QR code, polling, sync de perfil.

**Dados:** `comunicadores_evolution`; chamadas `fetchEvolutionMotoristaQrFromServer`, `Sync`, `Delete` em `lib/evolutionApi`.

**Funções:** `ComunicadorEvolutionSection`; ocultação global via `painel_motorista_evolution_ativo`; redirect automático para Configurações se a página ficar desligada (`DashboardLayout`).

**Vantagens:** WhatsApp próprio integrado à stack E-Transporte.

**Limitações:** Depende de backend Evolution configurado; feature pode ser desligada pelo admin.

---

### 6.33 Tickets (`tickets`)

**Objetivo:** Abrir pedidos de suporte.

**Dados:** `tickets` filtrados por `user_id`.

**Funções:** Tipos: melhoria, erro, dúvida, sugestão; estados com badges; resposta admin visível quando existir.

**Vantagens:** Trilho formal com a equipa.

---

### 6.34 Disparador (`disparador`)

**Objetivo:** Página de **marketing** para a ferramenta externa de disparo em massa (Baileys / WhatsApp).

**Dados:** Flag `disparador_consumo_liberado` de `usePlataformaFerramentasDisponibilidade`.

**Funções:** `SlideCarousel` página `disparador`; cartões de passos e avisos; botão que abre **`https://api-construtor.pro`** em nova aba se liberado; `FerramentaBetaBloqueioAviso` + `FerramentaConstrucaoOverlay` quando bloqueado.

**Vantagens:** Educação sobre risco de banimento e uso de chip secundário.

**Limitações:** Ferramenta **externa**; **BETA**; consumo controlado pela plataforma.

---

## 7. Fluxos práticos

### 7.1 Do pedido web à reserva Transfer

1. Solicitação aparece em **Transfer → Solicitações** (e em **Atualizações**).  
2. **Visualizar** detalhes.  
3. **Converter** → preencher `CriarReservaTransferDialog` → grava reserva e marca solicitação **`convertida`**.  
4. Em **Reservas**, usar **Comunicar** ou **PDF** conforme necessidade.

### 7.2 Configurar texto legal antes de enviar confirmações

1. **Transfer → Contrato** (e/ou **Grupos → Contrato**).  
2. Editar modelo, política e cláusulas.  
3. **Salvar** → `contratos` upsert.  
4. Pré-visualizar em **ContratoComoPdfPreview**.

### 7.3 Pedir link de geolocalização ao cliente

1. Ter reserva em **Transfer** ou **Grupos → Reservas**.  
2. **BETA → Geolocalização** → **Novo Link**.  
3. Escolher reserva e preencher opções → confirmação «Dados enviados ao webhook de geolocalização».

### 7.4 Converter candidato a motorista em ficha

1. **Motoristas → Solicitações** → **Converter** (não disponível se já `cadastrado`).  
2. Sistema navega para **Cadastros** com dialog pré-carregado via `sessionStorage`.  
3. Completar **CadastrarMotoristaDialog** e gravar (fluxo no componente).

### 7.5 Saída e retorno ao Network Nacional

- **Sair:** Home ou Configurações (secção Network) → confirmação → `persistNetworkSair`, cooldown **60 dias** antes de poder aceitar de novo sem fluxo especial (`persistNetworkRetornoSolicitado` limpa bloqueios após prazo — ver mensagens na UI).

---

## 8. Regras de negócio e permissões

- **Encaminhamento de painel:** `admin_master` → `/admin`; `admin_taxi` → `/taxi`; restantes → `/dashboard`.  
- **Abrangência:** visibilidade de reserva conforme `motorista_id` / `user_id` (ver secção 6.4).  
- **Network feed:** delete apenas próprio post no painel motorista; admin master teria poder extra noutro contexto.  
- **Comunidade:** moderador admin pode apagar posts de terceiros; autor apaga o seu (regra no `CommunityFeed`).  
- **Campanhas expiradas:** status → `encerrada` e remoção de `automacoes` associadas ao abrir **Campanhas Ativos**.  
- **Comunicador:** se `painel_motorista_evolution_ativo === false`, item some e página `sistema/comunicador` redireciona para **Configurações**.

---

## 9. Boas práticas

1. Tratar **Atualizações** como inbox diário.  
2. Manter **Contrato** Transfer e Grupos atualizados **antes** de picos de vendas.  
3. Usar **Automações** com payloads de teste reais antes de ativar em produção.  
4. **Geolocalização:** garantir que o webhook n8n está configurado (mensagem na própria página).  
5. **Parcerias:** até haver persistência Supabase, **não** confiar na página para arquivo legal — exportar/manual se necessário.  
6. **Disparador:** usar **sempre** número secundário conforme avisos da página.  
7. Completar **primeiros passos** na Home para evitar bloqueios em outras áreas.

---

## 10. Erros, limitações e resolução

| Sintoma | Causa | Acção |
|---------|-------|--------|
| Exportar CSV não faz nada (Transfer/Grupos/Motoristas solicitações) | Botão sem handler | Usar página **Leads** para campanhas (CSV real) ou export manual a partir dos dados em tabela quando disponível. |
| Parcerias «sumiram» | Estado só em memória | Volta ao comportamento esperado após reload — **limitação conhecida**. |
| Métricas não refletem operação | Dados estáticos | Usar listagens de reservas/solicitações e **Campanhas → Leads**. |
| Veículos sempre vazios | Placeholder | Aguardar desenvolvimento ou usar outro sistema. |
| Agendamentos sem dados | UI placeholder | Não usar para agendar ainda. |
| Geolocalização — lista de links vazia | Sem integração de leitura | Normal; o fluxo implementado é **só envio** ao webhook. |
| Disparador bloqueado | `disparador_consumo_liberado` falso | Contactar administração da plataforma. |
| Chat não aparece | Chatwoot / bloqueador de scripts | Confirmar `https://chatwoot.e-transporte.pro` acessível; variáveis `VITE_CHATWOOT_*` se usar instância própria. |
| Notificações na sidebar sem efeito | Sem `onClick` | Usar Atualizações / Tickets. |
| Sessão expira às 24h | `authExpiry` | Voltar a autenticar. |

---

## 11. Detalhes técnicos (alto nível)

- **Navegação:** `activePage` em React state + `sessionStorage` key `etp_nav_dashboard`; URL permanece `/dashboard`.  
- **Supabase:** cliente em `integrations/supabase/client.ts` (PKCE + sessionStorage).  
- **Realtime:** `network` (Network); `community_*` (Comunidade).  
- **RPCs relevantes:** `get_session_primary_role`, `get_motorista_abrangencia_reservas`, `get_my_mentoria_progress`.  
- **Webhooks cliente:** `dispatchComunicarWebhook` com tipos como `geolocalizacao`, e dialogs de comunicação com `webhookTipo` específicos por entidade.

---

## 12. Conclusão

O painel do motorista executivo concentra **toda a operação comercial e técnica** da frota: desde o **primeiro contacto** (solicitações e campanhas) até **reserva, contrato, PDF, comunicação automatizada, mapa, domínio, site, e-mail, Google, WhatsApp, comunidade e network**. A revisão deste manual deixou explícito **onde o código está completo** (Transfer, Grupos, Reservas, Contratos, Receptivos, QR, Leads, Automações, etc.) e **onde ainda há placeholders** (Métricas estáticas, Veículos, export CSV em algumas solicitações, Parcerias só em memória, Agendamentos sem backend visível).

Para **treino interno**, priorize: **Home → Atualizações → Transfer/Grupos → Reservas → Contrato → Automações → Campanhas/Leads → Comunidade/Network → Configurações**.

Para **entrega em larga escala** (milhares de utilizadores e grandes volumes de dados), trate **`README_SECURITY.md`** como checklist de release em conjunto com a secção **4.4** deste manual: segurança **absoluta** não resulta só do React — resulta de **RLS**, **Storage**, **webhooks assinados**, **auditoria** e **higiene de dependências** (`npm run security-check`, `npm audit`).

---

*Documento gerado e revisto com base nos ficheiros: `DashboardLayout.tsx`, `AppSidebar.tsx`, `Home.tsx`, `PAGE_MAP` e cada `src/pages/dashboard/*.tsx` listado no inventário.*
