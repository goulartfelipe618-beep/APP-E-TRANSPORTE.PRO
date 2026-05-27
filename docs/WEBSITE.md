# WEBSITE

Documento de referência para o **site institucional** do operador (produto **Website** no painel `admin_transfer` / Motorista Executivo). Define **todas as ferramentas existentes na plataforma** e **como o website deve apresentá-las em conteúdo e estrutura de páginas**.

**Âmbito deste documento:** catálogo funcional, mensagens, secções e ligações entre o site público e o painel. **Não** trata de layout visual, cores, tipografia, templates gráficos nem personalização estética — isso pertence ao briefing de produção (módulo `website` no painel).

**Público do site:** passageiros, empresas, agências, hotéis e parceiros que pesquisam transporte executivo. O site **vende e explica a operação**; o **painel** é onde o operador gere tudo após login.

---

## 1. Como o website deve estar organizado (estrutura de conteúdo)

O site institucional deve espelhar a lógica do painel sem expor o painel em si. A arquitetura de informação recomendada:

| Página / secção do site | Conteúdo obrigatório |
|-------------------------|----------------------|
| **Início** | Proposta de valor, região atendida, CTA de reserva (WhatsApp / formulário / link), resumo dos tipos de serviço (transfer, grupos, corporativo), prova social (depoimentos se existirem). |
| **Sobre a empresa** | Razão social ou nome fantasia, responsável, CNPJ quando aplicável, cidade sede, história, compromisso com padrão executivo. |
| **Serviços** | Lista alinhada ao painel: transfer aeroporto/hotel, corporativo, eventos, excursões, city tour, casamentos, grupos, etc. Cada item com descrição e CTA. |
| **Frota** | Veículos cadastrados no painel (`veiculos` + dados de frota em cadastros de motoristas quando relevante), amenidades (ar-condicionado, Wi-Fi, etc.). |
| **Destinos atendidos** | Aeroportos, rotas frequentes, mapa ou lista — coerente com **Abrangência** e região declarada no briefing. |
| **Reservar / Contato** | Formas de reserva escolhidas no briefing (WhatsApp, formulário, link de pagamento). Integração com captura de leads que alimenta o painel (`transfer/solicitacoes`, `grupos/solicitacoes`, `marketing/receptivos`). |
| **Blog** (opcional) | Conteúdo SEO e autoridade local; pode anunciar **Atualizações** da plataforma traduzidas para o cliente final quando fizer sentido. |
| **Depoimentos** (opcional) | Prova social; não substituir políticas contratuais. |
| **Área do cliente / Rastreio** (quando aplicável) | Link ou instrução para acompanhar viagem — alinhado à **Geolocalização** (`transfer/geolocalizacao`) e links públicos de rastreio gerados no painel. |
| **Políticas e termos** | Resumo dos contratos configurados em **Transfer → Contrato** e **Grupos → Contrato**; remeter que o documento completo é fornecido na confirmação. |
| **Trabalhe conosco / Seja motorista** (opcional) | CTA para formulário que alimenta **Motoristas → Solicitações** (PRÓ) ou página de captação externa. |
| **Login E-Transporte.pro** | Link discreto para `https://e-transporte.pro/login` — acesso ao painel do operador, não confundir com área do passageiro. |

**Integrações que o site deve mencionar quando activas:** WhatsApp, Instagram, Google Business, TripAdvisor, e-mail profissional (E-mail Business), domínio próprio (Domínios), formulário ligado a campanhas ou receptivos.

---

## 2. Experiência de entrada no painel (não é página do site público)

| Identificador | Nome | O que é | O que o website deve dizer |
|---------------|------|---------|---------------------------|
| `entrada` | Tela de entrada | Primeira vista após login no painel: marca **E-Transporte.pro** (logo oficial da plataforma). Não é configurável pelo operador. | Não publicar no site. Opcionalmente na página “Sobre a plataforma” ou rodapé B2B: “Gestão via painel E-Transporte.pro”. |

---

## 3. Principal — Painel

| Identificador | Nome no menu | Função no painel | Conteúdo que o website deve refletir |
|---------------|--------------|------------------|--------------------------------------|
| `home` | Home | Central operacional: atalhos para todas as áreas, carrossel de comunicação, fluxo de adesão ao **Network Nacional** quando pendente, avisos de configuração obrigatória. | A **Home** é interna. No site, reproduzir os **atalhos comerciais** (serviços, frota, reservar, contacto) em páginas públicas equivalentes. |
| `abrangencia` | Abrangência | Mapa das reservas do operador (um PIN por viagem, ponto de embarque da primeira partida). Visão geográfica da operação. | Secção **Destinos / Onde atendemos**: cidades, aeroportos, corredores. Não expor mapa interno; mostrar área de cobertura alinhada aos dados reais. |
| `agenda` | Agenda | Calendário mensal de reservas (transfer e grupos). | No site: “Disponibilidade sob consulta” ou formulário com data/hora; a agenda real é só no painel. Opcional: “Planeie com antecedência”. |
| `atualizacoes` | Atualizações | Novidades da plataforma E-Transporte.pro e avisos importantes para o operador. | Blog ou notícias **da empresa** no site; separar de atualizações **da plataforma** (só painel). |
| `metricas` | Métricas | Indicadores e desempenho da operação (gráficos, KPIs). | No site: números de marketing (anos de experiência, viagens realizadas) se verdadeiros — não copiar dashboards internos. |

---

## 4. Principal — Financeiro

| Identificador | Nome | Função no painel | Conteúdo que o website deve refletir |
|---------------|------|------------------|--------------------------------------|
| `financeiro` | Dashboard financeiro | Resumo do mês: faturado, recebido, pendente, lucro estimado. | Não expor. Site pode listar **formas de pagamento** aceites (PIX, cartão, etc.) conforme briefing. |
| `financeiro/lancamentos` | Lançamentos | Todas as receitas e despesas; lançamentos manuais. | Interno. |
| `financeiro/receber` | Contas a receber | Receitas geradas pelas reservas (transfer e grupos). | Interno. Site: política de pagamento e faturamento corporativo em texto simples. |
| `financeiro/pagar` | Contas a pagar | Despesas operacionais. | Interno. |
| `financeiro/relatorios` | Relatórios | Análise por período; viagens mais rentáveis. | Interno. |

---

## 5. Principal — Transfer

| Identificador | Nome | Plano mínimo | Função no painel | Conteúdo que o website deve refletir |
|---------------|------|--------------|------------------|--------------------------------------|
| `transfer/solicitacoes` | Solicitações | **PRÓ** | Pedidos e orçamentos de transfer antes de confirmação; origem em formulários web, campanhas, receptivos. | **Formulário de orçamento / reserva** no site deve alimentar este fluxo. Campos: origem, destino, data, hora, passageiros, bagagem, tipo de serviço. |
| `transfer/reservas` | Reservas | FREE* | Reservas confirmadas, contratos, estados da viagem, PDFs. | Página **Reservar**: CTA claro; após envio, mensagem de confirmação de recebimento. *FREE com limite diário de reservas no painel. |
| `transfer/contrato` | Contrato | **STANDART+** | Modelo de contrato e políticas do produto Transfer (texto legal, PDF). | Página **Termos / Contrato de prestação de serviço** — resumo público; documento integral na confirmação. |
| `transfer/geolocalizacao` | Geolocalização | FREE* | Rastreamento em tempo real; geração de links para o passageiro acompanhar a viagem. | Secção **Acompanhe sua viagem** ou link enviado por WhatsApp/e-mail após reserva. *FREE com quota mensal de links. |

---

## 6. Principal — Grupos

| Identificador | Nome | Plano mínimo | Função no painel | Conteúdo que o website deve refletir |
|---------------|------|--------------|------------------|--------------------------------------|
| `grupos/solicitacoes` | Solicitações | **PRÓ** | Pedidos de transporte em grupo (eventos, excursões, corporativo em volume). | Formulário **Grupos / Eventos** com número de pessoas, itinerário, datas, tipo de evento. |
| `grupos/reservas` | Reservas | FREE* | Reservas de grupo confirmadas e valores. | Confirmação comercial no site; detalhes operacionais no painel. |
| `grupos/contrato` | Contrato | **STANDART+** | Contrato e termos específicos para grupos. | Termos para **serviços em grupo** na área legal do site. |

---

## 7. Principal — Motoristas

| Identificador | Nome | Plano mínimo | Função no painel | Conteúdo que o website deve refletir |
|---------------|------|--------------|------------------|--------------------------------------|
| `motoristas/cadastros` | Cadastros | FREE* | Fichas de motoristas parceiros, documentação, vínculo com veículos, portal do motorista (PRÓ). | Site institucional: fotos e bio do **motorista titular** ou equipe se o operador quiser humanizar a marca. Submotoristas: portal separado `/frota` — não misturar no site B2C. *FREE com limite de motoristas cadastrados. |
| `motoristas/solicitacoes` | Solicitações | **PRÓ** | Candidaturas e pedidos de vínculo de novos motoristas. | Página **Trabalhe conosco / Parceiros** com formulário de candidatura. |
| `motoristas/agendamentos` | Agendamentos (rota interna) | — | Calendário de reuniões com motoristas; **sem item dedicado no menu lateral**; acesso por atalhos contextuais. | Não é página pública. Se o site mencionar “reunião comercial”, usar formulário de contacto genérico. |

---

## 8. Principal — Clientes e Veículos

| Identificador | Nome | Função no painel | Conteúdo que o website deve refletir |
|---------------|------|------------------|--------------------------------------|
| `clientes` | Clientes | CRM: cadastro de clientes, histórico, notas internas. | Site não expõe base de clientes. Formulário de reserva cria lead/cliente no painel. |
| `veiculos` | Veículos | Cadastro da frota: matrícula, categoria, documentação, imagem de capa. | Página **Frota** com modelos, ano, amenidades, fotos reais dos veículos cadastrados. |

---

## 9. Marketing

| Identificador | Nome | Plano mínimo | Função no painel | Conteúdo que o website deve refletir |
|---------------|------|--------------|------------------|--------------------------------------|
| `campanhas/ativos` | Campanhas — Ativos | **STANDART+** | Landing pages e campanhas de captação activas (UTM, criativos). | O **próprio site** pode ser destino de campanhas Google/Meta; páginas de aterragem específicas por serviço ou promoção. |
| `campanhas/leads` | Campanhas — Leads | **STANDART+** | Leads gerados pelas campanhas; funil e conversão. | Formulários do site devem estar rastreáveis (origem, campanha). Política de privacidade LGPD. |
| `email-business` | E-mail Business | **PRÓ** | E-mail profissional com domínio próprio. | Site deve exibir **@seudominio.com** nos contactos quando o serviço estiver activo. |
| `website` | Website | **PRÓ** | Pedido e acompanhamento de produção do site institucional (briefing, templates, estados: pendente, em desenvolvimento, publicado). | Este documento guia o **conteúdo** desse site. O operador solicita produção aqui; o site publicado é o produto entregue. |
| `dominios` | Domínios | **PRÓ** | Gestão de domínio personalizado, DNS, validação. | URL pública do site (`www.operador.com.br`) configurada neste módulo. |
| `comunidade` | Comunidade | — | Feed social entre operadores da plataforma (categorias, posts, moderação). | **Não** é fórum público para passageiros. Não criar secção “Comunidade” no site B2C salvo se for rede fechada de parceiros com login. |
| `network` | Network | Condicional* | Bolsa de oportunidades **Network Nacional E-Transporte.pro** entre motoristas (viagens compartilhadas). | *Menu só após aceitar ou recusar termos na Home. Site B2C: não expor. Site B2B parceiros: opcional mencionar participação em rede nacional se o operador for membro. |

---

## 10. Ferramentas

| Identificador | Nome | Função no painel | Conteúdo que o website deve refletir |
|---------------|------|------------------|--------------------------------------|
| `marketing/receptivos` | Receptivos | Páginas e materiais PDF de captação “receptivo” (modelos 1–4); geração de PDF com identidade do operador. | Landing pages de **receptivo turístico** (hotel, agência) podem ser URLs dedicadas ligadas a este módulo. |
| `marketing/qrcode` | QR Codes | Geração de QR para URLs (WhatsApp, agendamento, contrato, etc.). | QR codes em materiais impressos, veículos, cartões — apontando para páginas do site ou WhatsApp. |
| `transfer/geolocalizacao` | Geolocalização | (Ver secção Transfer.) | (Ver secção Transfer.) |

---

## 11. Beta

| Identificador | Nome | Função no painel | Conteúdo que o website deve refletir |
|---------------|------|------------------|--------------------------------------|
| `disparador` | Disparador | Envio de mensagens em massa (ex.: WhatsApp). | Interno. Site: apenas canal oficial de contacto (não prometer spam). |
| `empty-legs` | Empty Legs | Publicação de pernas vazias / retornos com desconto. | Opcional: secção **Oportunidades** ou **Viagens com desconto** se o operador publicar ofertas públicas; senão manter só no Network/painel. |
| `mentoria` | Mentoria | Conteúdos educativos e trilha de desenvolvimento para operadores. | Interno (formação do operador). Não confundir com “mentoria ao cliente”. |

---

## 12. Configurações

| Identificador | Nome | Plano mínimo | Função no painel | Conteúdo que o website deve refletir |
|---------------|------|--------------|------------------|--------------------------------------|
| `documentacao` | Documentação | — | Manual in-app do painel (procedimentos, glossário, matriz de planos). | Não publicar no site B2C. Suporte técnico do operador usa o painel. |
| `sistema/configuracoes` | Configurações | — | Perfil, empresa, logo do operador, nome do projeto, fonte global, cabeçalho contratual, CNPJ, segurança (senha, 2FA), zoom do painel. **Onboarding obrigatório** no primeiro acesso. | Dados de **Configurações** alimentam o site: logo, nome, contactos, cores preferidas no briefing Website, textos legais do contratual. |
| `sistema/automacoes` | Automações | **PRÓ** | Webhooks e regras evento-condição-ação (pagamentos, leads, integrações). | Invisível no site; garante que formulário → solicitação no painel funcione em tempo real. |
| `sistema/comunicador` | Comunicador | Condicional** | WhatsApp oficial via Evolution API: instância, QR, inbox (quando activo para o tenant). | Site: botão WhatsApp com o **número comercial** do operador. ** | **Visível só se a plataforma activar Evolution para o operador. |
| `anotacoes` | Anotações | — | Bloco de notas interno do operador. | Interno. |
| `tickets` | Suporte | — | Chamados à equipa E-Transporte.pro. | Site: link **Suporte ao cliente** (telefone/e-mail do operador), não o ticketing interno da plataforma. |
| `planos` | Planos | — | Comparação FREE / STANDART / PRÓ, upgrade Mercado Pago, estado da subscrição. | Página comercial **E-Transporte.pro** (plataforma), não do operador. No site do operador: não listar planos da plataforma. |

---

## 13. Módulos e rotas internas (não aparecem no menu mas existem no painel)

| Identificador | Situação | Função | Website |
|---------------|----------|--------|---------|
| `whatsapp` | Rota descontinuada no menu; redirecciona para `entrada` | Inbox WhatsApp (Evolution) — substituído por `sistema/comunicador` quando activo. | Usar WhatsApp Business link público; gestão no Comunicador. |
| `catalogo` | Descontinuado | Redireccionamento para entrada. | Não referenciar. |
| `google` | Descontinuado | Redireccionamento para entrada. | Google Business no briefing (redes), não módulo painel. |

---

## 14. Comunicação in-app (não são “páginas” do site)

| Mecanismo | Função | Website |
|-----------|--------|---------|
| **PainelAvisoBanner** | Banners por página (`paginas_motorista`) ou globais — avisos da plataforma ao operador. | Equivalente público: barra de aviso no site (promoção sazonal, greve aeroporto) — conteúdo editável pelo operador, não ligado ao banner técnico do painel. |
| **FullscreenBannerOverlay** | Banners fullscreen no painel motorista. | Não replicar no site salvo campanha promocional pontual. |
| **SlideCarousel** (`home`, `website`, etc.) | Carrossel educativo/comercial dentro do painel. | Hero slider na **página inicial** do site com mensagens comerciais. |
| **Network spotlight** | Destaque do menu Network após adesão. | N/A no site B2C. |
| **Onboarding** | Força `sistema/configuracoes` até perfil/contratual/senha completos; depois decisão Network na `home`. | Site pode estar no ar antes do onboarding completo; dados inconsistentes no site devem ser evitados — priorizar concluir Configurações antes de publicar. |

---

## 15. Controles da barra lateral (rodapé do painel)

| Item | Função | Website |
|------|--------|---------|
| **Notificações** | Placeholder / avisos no painel. | Newsletter ou opt-in WhatsApp no site (com consentimento). |
| **Modo claro / escuro** | Tema do painel. | Tema do site definido no briefing Website (estilo: minimalista, luxo, etc.) — sem duplicar controles do painel. |
| **Zoom do painel** | Acessibilidade do viewport interno. | N/A. |
| **Sair** | Terminar sessão Supabase. | N/A. |

---

## 16. Matriz de planos (o que o site pode prometer)

| Plano | O operador pode no painel | Impacto no website |
|-------|---------------------------|-------------------|
| **FREE** | Reservas limitadas/dia, motoristas limitados, links geo limitados/mês; sem solicitações PRÓ, sem contrato STANDART+, sem campanhas STANDART+. | Site simples: formulário básico, WhatsApp, frota; sem prometer portal de orçamento automático avançado se bloqueado. |
| **STANDART** | + Contratos transfer/grupos, + Campanhas ativos/leads. | Site com páginas legais e captura de leads estruturada. |
| **PRÓ** | + Solicitações transfer/grupos/motoristas, + E-mail Business, + Website (produção), + Domínios, + Automações, + portal motorista. | Site completo, domínio próprio, e-mail @domínio, formulários integrados, mini portal do motorista (não é o site institucional). |

**Páginas PRÓ obrigatórias para funcionalidade completa de captação:** `transfer/solicitacoes`, `grupos/solicitacoes`, `motoristas/solicitacoes`, `email-business`, `website`, `dominios`, `sistema/automacoes`.

---

## 17. Fluxos que o website deve suportar (ponta a ponta)

1. **Visitante → Orçamento transfer**  
   Site (formulário) → webhook/automação → `transfer/solicitacoes` → operador converte em `transfer/reservas` → PDF/contrato → link `transfer/geolocalizacao` no dia da viagem.

2. **Visitante → Evento em grupo**  
   Site (formulário grupos) → `grupos/solicitacoes` → `grupos/reservas` → contrato grupo.

3. **Agência / hotel (receptivo)**  
   URL receptivo ou PDF `marketing/receptivos` → lead ou solicitação.

4. **Campanha paga**  
   Landing `campanhas/ativos` → lead em `campanhas/leads` → contacto comercial.

5. **Candidato motorista**  
   Site “Trabalhe conosco” → `motoristas/solicitacoes` → aprovação → `motoristas/cadastros`.

6. **Cliente corporativo recorrente**  
   Site → `clientes` (cadastro interno) + reservas manuais no painel.

7. **Upgrade do operador**  
   Não é fluxo do site B2C; ocorre em `planos` no painel.

---

## 18. O que NÃO faz parte do painel `admin_transfer` (não misturar no website institucional)

| Produto | Utilizador | Nota para o documento WEBSITE |
|---------|------------|-------------------------------|
| **Portal `/frota`** | Motorista subordinado (frota) | Área restrita pós-convite; não é o site marketing do operador. |
| **Painel `/admin`** | `admin_master` | Gestão da plataforma; irrelevante para o site do operador. |
| **Rastreio público `/rastreio/:token`** | Passageiro | Página isolada; o site pode **linkar** após reserva, não duplicar. |
| **Verificar motorista `/verificar-motorista`** | Público | QR de verificação de credencial; opcional no site “Motoristas credenciados”. |
| **Login `/login`** | Operador | Acesso ao painel. |

---

## 19. Checklist — nenhuma ferramenta do menu `admin_transfer` em falta

### Principal
- [x] `entrada` — Tela de entrada (pós-login)
- [x] `home` — Home
- [x] `abrangencia` — Abrangência
- [x] `agenda` — Agenda
- [x] `atualizacoes` — Atualizações
- [x] `metricas` — Métricas
- [x] `financeiro` — Dashboard financeiro
- [x] `financeiro/lancamentos` — Lançamentos
- [x] `financeiro/receber` — Contas a receber
- [x] `financeiro/pagar` — Contas a pagar
- [x] `financeiro/relatorios` — Relatórios
- [x] `transfer/solicitacoes` — Transfer solicitações
- [x] `transfer/reservas` — Transfer reservas
- [x] `transfer/contrato` — Transfer contrato
- [x] `transfer/geolocalizacao` — Geolocalização
- [x] `grupos/solicitacoes` — Grupos solicitações
- [x] `grupos/reservas` — Grupos reservas
- [x] `grupos/contrato` — Grupos contrato
- [x] `motoristas/cadastros` — Motoristas cadastros
- [x] `motoristas/solicitacoes` — Motoristas solicitações
- [x] `motoristas/agendamentos` — Motoristas agendamentos (rota interna)
- [x] `clientes` — Clientes
- [x] `veiculos` — Veículos

### Marketing
- [x] `campanhas/ativos` — Campanhas ativos
- [x] `campanhas/leads` — Campanhas leads
- [x] `email-business` — E-mail Business
- [x] `website` — Website (pedido de produção)
- [x] `dominios` — Domínios
- [x] `comunidade` — Comunidade
- [x] `network` — Network (condicional)

### Ferramentas
- [x] `marketing/receptivos` — Receptivos
- [x] `marketing/qrcode` — QR Codes

### Beta
- [x] `disparador` — Disparador
- [x] `empty-legs` — Empty Legs
- [x] `mentoria` — Mentoria

### Configurações
- [x] `documentacao` — Documentação
- [x] `sistema/configuracoes` — Configurações
- [x] `sistema/automacoes` — Automações
- [x] `sistema/comunicador` — Comunicador (condicional)
- [x] `anotacoes` — Anotações
- [x] `tickets` — Suporte
- [x] `planos` — Planos

### Rotas legadas / auxiliares
- [x] `whatsapp` — Inbox (descontinuado no menu)
- [x] `catalogo` / `google` — Descontinuados

### Comunicação e shell do painel
- [x] Banners e carrosséis in-app
- [x] Onboarding e Network Nacional
- [x] Rodapé: notificações, tema, zoom, sair

---

## 20. Síntese: como o website deve “ficar” em termos de produto

O **website institucional** é a vitrine comercial da operação cadastrada em **Configurações** e produzida via módulo **Website (PRÓ)**. Deve:

1. **Explicar todos os serviços** que o painel gere (transfer, grupos, frota, região, diferenciais, pagamentos, idiomas).
2. **Converter visitantes** em solicitações/reservas/leads nos módulos correctos do painel.
3. **Reflectir dados reais** de `veiculos`, `sistema/configuracoes` e contratos — sem prometer ferramentas bloqueadas pelo plano FREE/STANDART.
4. **Separar claramente** o que é experiência do passageiro (site + rastreio + WhatsApp) do que é gestão interna (painel E-Transporte.pro).
5. **Incluir todas as integrações** activas: domínio, e-mail, redes, WhatsApp, formulários, QR, receptivos, campanhas.
6. **Manter coerência legal** com `transfer/contrato` e `grupos/contrato`.
7. **Não omitir** Network, Empty Legs ou Comunidade na documentação interna; no site B2C só expor o que for política comercial pública do operador.

Este ficheiro deve ser a **fonte única de verdade** para redactores, equipa de produção de sites e integradores que montam o website a partir do painel `admin_transfer`.

---

*Última revisão alinhada ao código: painel Motorista Executivo (`DashboardLayout` + `AppSidebar` + `painelPlanPolicy`).*
