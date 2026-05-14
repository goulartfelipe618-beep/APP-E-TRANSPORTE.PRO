/**
 * Conteúdo textual do manual in-app do painel Motorista Executivo (role admin_transfer).
 * Não incluir segredos, chaves, tokens, URLs internas de infraestrutura nem dados reais de clientes.
 */

export type DocCalloutVariant = "info" | "warning" | "security";

export type DocBlock =
  | { t: "p"; text: string }
  | { t: "h3"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "callout"; variant: DocCalloutVariant; title: string; body: string };

export type DocChunk = { id: string; title: string; blocks: DocBlock[] };

export type DocSection = { id: string; title: string; chunks: DocChunk[] };

export const DOC_PAINEL_LEITURA_OBRIGATORIA: DocBlock[] = [
  {
    t: "callout",
    variant: "security",
    title: "Confidencialidade e âmbito deste manual",
    body:
      "Este texto descreve apenas a interface do painel autenticado (utilizador com função de motorista executivo / admin_transfer). Não documenta credenciais de serviço, chaves de API, segredos de webhook, URLs de projeto nem procedimentos de administrador global da plataforma. Qualquer operação destrutiva sobre identidades ou dados sensíveis deve ser canalizada pelos mecanismos oficiais de suporte ou pela consola de base de dados, fora do âmbito deste guia.",
  },
  {
    t: "p",
    text:
      "O presente manual adota vocabulário técnico deliberadamente denso — incluindo neologismos compostos e metáforas de engenharia de software — para servir de referência monolítica. Cada módulo correlaciona-se com um identificador de rota interna (`page id`) persistido em `sessionStorage` sob a chave `etp_nav_dashboard`, o que explica a continuidade da navegação entre recarregamentos da aba.",
  },
];

export const DOC_PAINEL_SECOES: DocSection[] = [
  {
    id: "arquitetura",
    title: "Arquitetura cognitiva do painel",
    chunks: [
      {
        id: "arquitetura-visao",
        title: "Visão sistémica e multi-tenant",
        blocks: [
          {
            t: "p",
            text:
              "O painel opera como aplicação **single-page** embutida num contentor de layout persistente. O utilizador autenticado enxerga unicamente entidades cujo `user_id` coincide com o identificador da sessão — padrão multi-tenant mediado por políticas de segurança ao nível da linha (RLS) na base de dados. Isto implica que métricas, reservas, PDFs e anexos são sempre **escopados** ao seu arrendatário lógico.",
          },
          {
            t: "p",
            text:
              "A barra lateral (`AppSidebar`) funciona como taxonomia primária: agrupa módulos em **Principal**, **Marketing**, **Ferramentas**, **Beta** e **Configurações**. Cada clique invoca `setActivePage(pageId)` sem alterar a URL do router — daí a necessidade de mentalizar o `page id` quando comunicar incidentes ao suporte.",
          },
          {
            t: "ul",
            items: [
              "**Cabeçalho**: `SidebarTrigger` colapsa a grelha; título contextual “E-Transporte.pro — Gestão de Frota”.",
              "**Rodapé da sidebar**: atalhos de tema (claro/escuro), zoom do painel, terminação de sessão (`signOut`).",
              "**Badges PRÓ / ST+**: heurística de plano; indicam que o módulo alvo exige upgrade contratual — ver secção sobre matriz de planos.",
            ],
          },
        ],
      },
      {
        id: "arquitetura-onboarding",
        title: "Onboarding bifásico e coerção de navegação",
        blocks: [
          {
            t: "p",
            text:
              "Antes de concluir o **primeiro marco** (perfil, cabeçalho contratual, redefinição de senha, metadados de projeto), o motor de onboarding **força** a rota `sistema/configuracoes`. Após esse marco, enquanto a adesão ao **Network Nacional** não estiver gravada como “sim” ou “não”, o painel tende a **priorizar** a `home` para exibir o fluxo de decisão.",
          },
          {
            t: "callout",
            variant: "info",
            title: "Exceção explícita para este manual",
            body:
              "A página **Documentação** (`documentacao`) é deliberadamente acessível mesmo durante coerções de onboarding, para que possa consultar procedimentos enquanto completa campos obrigatórios.",
          },
          {
            t: "p",
            text:
              "As pendências listadas no ecrã de configurações são derivadas de regras declarativas sobre campos `NOT NULL` lógicos — não dispensam a leitura contratual dos rótulos de cada secção.",
          },
        ],
      },
    ],
  },
  {
    id: "principal-painel",
    title: "Principal — grupo Painel",
    chunks: [
      {
        id: "pp-home",
        title: "Home (`home`)",
        blocks: [
          {
            t: "p",
            text:
              "A Home constitui o **dashboard operacional**: agrega atalhos contextuais, estado de campanhas, lembretes de configuração e, quando aplicável, o **spotlight** de aceitação do Network Nacional. Utilize-a como ponto de partida matinal para verificar inconsistências de branding ou lacunas de integração.",
          },
          {
            t: "ul",
            items: [
              "Interaja com cartões de métricas rápidas que encaminham para submódulos específicos.",
              "Observe banners de aviso global — estes são injetados pela camada de configuração e podem referenciar manutenção programada.",
            ],
          },
        ],
      },
      {
        id: "pp-abrangencia",
        title: "Abrangência (`abrangencia`)",
        blocks: [
          {
            t: "p",
            text:
              "Módulo de **geofencing operacional**: delimita jurisdições de atendimento, tempos médios e possivelmente integrações cartográficas. A abrangência alimenta expectativas de SLA em formulários públicos e filtros internos de solicitação.",
          },
          {
            t: "p",
            text:
              "Ao alterar polígonos ou listas de municípios, valide a **consistência semântica** com o contrato comercial que exibe ao passageiro — divergências geram litígio reputacional.",
          },
        ],
      },
      {
        id: "pp-agenda",
        title: "Agenda (`agenda`)",
        blocks: [
          {
            t: "p",
            text:
              "A agenda centraliza **eventos temporais** — transferências, reuniões internas, manutenção de viatura — numa cronologia unificada. Pense na agenda como índice B-tree humano: ordenação temporal estrita evita sobreposição de recursos humanos.",
          },
        ],
      },
      {
        id: "pp-atualizacoes",
        title: "Atualizações (`atualizacoes`)",
        blocks: [
          {
            t: "p",
            text:
              "Canal de **release notes** e comunicados da plataforma. Cada item pode conter `paginaDestino` — hiperligação interna que invoca `setActivePage` para aprofundar a funcionalidade anunciada.",
          },
        ],
      },
      {
        id: "pp-metricas",
        title: "Métricas (`metricas`)",
        blocks: [
          {
            t: "p",
            text:
              "Painel analítico com **telemetria agregada**: séries temporais, funis de conversão e indicadores de utilização de frota. Os gráficos são tipicamente alimentados por consultas materializadas ou agregações on-the-fly — latências de refrescamento dependem da cardinalidade dos factos.",
          },
        ],
      },
    ],
  },
  {
    id: "principal-financeiro",
    title: "Principal — Financeiro",
    chunks: [
      {
        id: "fin-dashboard",
        title: "Dashboard (`financeiro`)",
        blocks: [
          {
            t: "p",
            text:
              "Visão **holística** do fluxo de caixa operacional: saldos sintéticos, compromissos futuros e drill-down para lançamentos. Utilize-o para reconciliação diária antes de exportar relatórios.",
          },
        ],
      },
      {
        id: "fin-lancamentos",
        title: "Lançamentos (`financeiro/lancamentos`)",
        blocks: [
          {
            t: "p",
            text:
              "Registo **granular** de movimentos contabilísticos ou operacionais (conforme modelo de dados do projeto). Cada lançamento deve ser pensado como transação ACID: após confirmação, reversões podem exigir estorno explícito.",
          },
          {
            t: "ul",
            items: [
              "Filtros por intervalo temporal e natureza (receita/despesa).",
              "Ligações contextuais para contas a receber ou a pagar quando existir chave estrangeira lógica.",
            ],
          },
        ],
      },
      {
        id: "fin-receber",
        title: "Contas a receber (`financeiro/receber`)",
        blocks: [
          {
            t: "p",
            text:
              "**Contas a receber** consolidam obrigações de terceiros para com a sua unidade de negócio. Acompanhe estados (em aberto, parcial, liquidado) e utilize lembretes para antecipar inadimplência.",
          },
        ],
      },
      {
        id: "fin-pagar",
        title: "Contas a pagar (`financeiro/pagar`)",
        blocks: [
          {
            t: "p",
            text:
              "Espelho simétrico das obrigações **outbound**: fornecedores, combustível, seguros, leasing. Mantenha anexos comprobatórios para auditoria fiscal.",
          },
        ],
      },
      {
        id: "fin-relatorios",
        title: "Relatórios (`financeiro/relatorios`)",
        blocks: [
          {
            t: "p",
            text:
              "Agregações **ad hoc** ou pré-definidas exportáveis (CSV, PDF — conforme implementação). Ideal para encerramentos mensais e conciliação bancária.",
          },
        ],
      },
    ],
  },
  {
    id: "principal-transfer",
    title: "Principal — Transfer",
    chunks: [
      {
        id: "tr-sol",
        title: "Solicitações (`transfer/solicitacoes`) — requer PRÓ",
        blocks: [
          {
            t: "p",
            text:
              "Repositório de **pedidos pré-contratuais** de serviço VIP / transfer. Inclui ingestão via formulários web, validação humana e transição para reserva confirmada.",
          },
          {
            t: "callout",
            variant: "warning",
            title: "Restrição de plano",
            body:
              "Este módulo exige plano **PRÓ**. Utilizadores em FREE ou STANDART verão bloqueio ou convite de upgrade na interface.",
          },
        ],
      },
      {
        id: "tr-res",
        title: "Reservas (`transfer/reservas`)",
        blocks: [
          {
            t: "p",
            text:
              "As **reservas** representam compromissos cristalizados: data, hora, rota, viatura alocada e passageiro. Aqui efetua-se a gestão do ciclo de vida (confirmada, em curso, concluída, cancelada).",
          },
          {
            t: "p",
            text:
              "No plano **FREE**, observe os limites quantitativos diários de reservas (constante de produto `FREE_MAX_RESERVAS_DIA`) — ultrapassar o tecto implica upgrade ou deslocação temporal.",
          },
        ],
      },
      {
        id: "tr-contrato",
        title: "Contrato (`transfer/contrato`) — requer STANDART+",
        blocks: [
          {
            t: "p",
            text:
              "Área de **cláusulas contratuais** e PDFs vinculativos ao serviço de transfer. Sincronize o texto legal com o cabeçalho contratual global para evitar bifurcação semântica.",
          },
          {
            t: "callout",
            variant: "warning",
            title: "Restrição de plano",
            body: "Plano mínimo **STANDART** (badge ST+ no menu quando em FREE).",
          },
        ],
      },
    ],
  },
  {
    id: "principal-grupos",
    title: "Principal — Grupos",
    chunks: [
      {
        id: "gr-sol",
        title: "Solicitações (`grupos/solicitacoes`) — PRÓ",
        blocks: [
          {
            t: "p",
            text:
              "Análogo ao fluxo de transfer, porém especializado em **logística coletiva** — excursões, eventos corporativos, congressos. Mantém pipeline próprio de aprovação.",
          },
        ],
      },
      {
        id: "gr-res",
        title: "Reservas (`grupos/reservas`)",
        blocks: [
          {
            t: "p",
            text:
              "Gestão de **slots de ocupação** e capacidade de veículos de maior volume. Verifique conflitos de sobreposição de motoristas partilhados entre grupos concorrentes.",
          },
        ],
      },
      {
        id: "gr-contrato",
        title: "Contrato (`grupos/contrato`) — STANDART+",
        blocks: [
          {
            t: "p",
            text:
              "Documentação legal específica de **serviço em grupo**. Pode divergir do contrato unitário de transfer — leia sempre a versão vigente antes de assinar digitalmente em nome do cliente.",
          },
        ],
      },
    ],
  },
  {
    id: "principal-motoristas",
    title: "Principal — Motoristas",
    chunks: [
      {
        id: "mot-cad",
        title: "Cadastros (`motoristas/cadastros`)",
        blocks: [
          {
            t: "p",
            text:
              "**CRUD** de motoristas subordinados: documentação, habilitações, vínculo com veículos e estado de compliance. No FREE existe teto `FREE_MAX_MOTORISTAS_CADASTRADOS` — ultrapassar implica desativação de criação ou upgrade.",
          },
          {
            t: "ul",
            items: [
              "Pré-preenchimento pode ocorrer via fluxos de conversão de solicitação — dados transitam em `sessionStorage` volátil, não persistem após fecho do browser.",
              "Portal do motorista (subdomínio ou rota dedicada) consome estas entidades com permissões mais restritas.",
            ],
          },
        ],
      },
      {
        id: "mot-sol",
        title: "Solicitações (`motoristas/solicitacoes`) — PRÓ",
        blocks: [
          {
            t: "p",
            text:
              "Fila de **candidaturas** ou pedidos de vínculo laboral / prestador de serviço. Trabalhe com estados explícitos (pendente, aprovado, arquivado) para manter rastreabilidade LGPD.",
          },
        ],
      },
      {
        id: "mot-agenda-legacy",
        title: "Nota técnica: rota `motoristas/agendamentos`",
        blocks: [
          {
            t: "p",
            text:
              "Existe mapeamento interno `motoristas/agendamentos` → ecrã de agendamentos de motorista **sem** entrada dedicada na barra lateral atual. O acesso pode ocorrer via hiperligações contextuais (ex.: avisos administrativos) ou histórico de `sessionStorage`. Não confunda com **Painel → Agenda** (`agenda`), que é o calendário macro do operador.",
          },
        ],
      },
    ],
  },
  {
    id: "principal-outros",
    title: "Principal — Clientes e Veículos",
    chunks: [
      {
        id: "cli",
        title: "Clientes (`clientes`)",
        blocks: [
          {
            t: "p",
            text:
              "**CRM** embutido: cadastro de tomadores finais, histórico de viagens, notas internas. Dados sensíveis devem ser minimizados (princípio da minimização de dados pessoais).",
          },
        ],
      },
      {
        id: "vei",
        title: "Veículos (`veiculos`)",
        blocks: [
          {
            t: "p",
            text:
              "Frota documental: matrícula, categoria, inspeções, seguros. A correta associação motorista ↔ viatura é pré-requisito para disponibilizar capacidade nas reservas.",
          },
        ],
      },
    ],
  },
  {
    id: "marketing",
    title: "Marketing",
    chunks: [
      {
        id: "mk-camp-ativ",
        title: "Campanhas — Ativos (`campanhas/ativos`) — STANDART+",
        blocks: [
          {
            t: "p",
            text:
              "Orquestra **ativos de mídia** — landing pages, criativos, UTMs. Cada campanha deve ter objetivo mensurável (CTR, CPL) para retroalimentar o módulo de leads.",
          },
        ],
      },
      {
        id: "mk-camp-leads",
        title: "Campanhas — Leads (`campanhas/leads`) — STANDART+",
        blocks: [
          {
            t: "p",
            text:
              "Funil de **prospects**: importação, deduplicação heurística e conversão em cliente ou motorista. Utilize filtros de origem para isolar canais de aquisição.",
          },
        ],
      },
      {
        id: "mk-email",
        title: "E-mail Business (`email-business`) — PRÓ",
        blocks: [
          {
            t: "p",
            text:
              "Ferramentas de **e-mail transacional ou marketing** com domínio próprio. Configure SPF, DKIM e DMARC no DNS do seu domínio — a interface guia, mas não substitui o painel do registador.",
          },
        ],
      },
      {
        id: "mk-web",
        title: "Website (`website`) — PRÓ",
        blocks: [
          {
            t: "p",
            text:
              "Editor **WYSIWYG** ou blocos de template para site institucional. Publicações geram HTML estático ou dinâmico conforme pipeline de deploy do projeto.",
          },
        ],
      },
      {
        id: "mk-dom",
        title: "Domínios (`dominios`) — PRÓ",
        blocks: [
          {
            t: "p",
            text:
              "Gestão de **hostname** personalizado: validação de propriedade, estado de aprovação e possíveis erros de propagação DNS (TTL, CNAME flattening).",
          },
        ],
      },
      {
        id: "mk-com",
        title: "Comunidade (`comunidade`)",
        blocks: [
          {
            t: "p",
            text:
              "Feed social **inter-tenant** moderado pela plataforma: categorias, reações, anexos. Mantenha etiqueta profissional — conteúdo reportável pode ser alvo de sanções contratuais.",
          },
        ],
      },
      {
        id: "mk-net",
        title: "Network (`network`) — condicional",
        blocks: [
          {
            t: "p",
            text:
              "Visível apenas após aceitar (ou recusar explicitamente) os termos do **Network Nacional** na base de dados. Funciona como bolsa de oportunidades de **empty legs** cooperativos entre pares.",
          },
        ],
      },
    ],
  },
  {
    id: "ferramentas",
    title: "Ferramentas",
    chunks: [
      {
        id: "fer-geo",
        title: "Geolocalização (`transfer/geolocalizacao`)",
        blocks: [
          {
            t: "p",
            text:
              "**Rastreio em tempo real** ou geração de ligações partilháveis para passageiros acompanharem o deslocamento. No FREE existe quota mensal `FREE_MAX_LINKS_GEO_MES` — monitore consumo antes de picos sazonais.",
          },
        ],
      },
      {
        id: "fer-rec",
        title: "Receptivos (`marketing/receptivos`)",
        blocks: [
          {
            t: "p",
            text:
              "Gestão de **páginas de captura** inbound — formulários que alimentam leads ou solicitações. Teste sempre o fluxo em janela anónima para validar cookies e CSRF.",
          },
        ],
      },
      {
        id: "fer-qr",
        title: "QR Codes (`marketing/qrcode`)",
        blocks: [
          {
            t: "p",
            text:
              "Geração vetorial de **matrizes QR** apontando para URLs públicas (agendamento, WhatsApp, contrato). Prefira contraste alto e margem silenciosa para leitura fiável em ambientes de baixa luminosidade.",
          },
        ],
      },
    ],
  },
  {
    id: "beta",
    title: "Beta",
    chunks: [
      {
        id: "be-dis",
        title: "Disparador (`disparador`)",
        blocks: [
          {
            t: "p",
            text:
              "Automação de **mensagens em massa** (SMS, WhatsApp ou canais integrados). Utilize listas segmentadas; spam viola políticas de carriers e da plataforma.",
          },
        ],
      },
      {
        id: "be-el",
        title: "Empty Legs (`empty-legs`)",
        blocks: [
          {
            t: "p",
            text:
              "Publicação de **pernas vazias** — retornos de veículo sem passageiro remunerado. Negociação típica com desconto agressivo para maximizar fator de ocupação.",
          },
        ],
      },
      {
        id: "be-men",
        title: "Mentoria (`mentoria`)",
        blocks: [
          {
            t: "p",
            text:
              "Conteúdos pedagógicos, webinars gravados ou calendário de sessões 1:1. Trate como **acelerador comercial**, não como substituto de suporte técnico de incidentes.",
          },
        ],
      },
    ],
  },
  {
    id: "configuracoes",
    title: "Configurações",
    chunks: [
      {
        id: "cfg-sis",
        title: "Sistema — Configurações (`sistema/configuracoes`)",
        blocks: [
          {
            t: "p",
            text:
              "**Epicentro** de branding: logotipo, paleta, nome do projeto, fonte tipográfica global, dados de contacto e flags de conformidade. Campos vazios propagam-se como `NULL` em PDFs — evite omissões.",
          },
          {
            t: "ol",
            items: [
              "Carregue imagens dentro dos limites MIME permitidos; o backend valida assinaturas binárias (magic bytes).",
              "Após gravação, dispare mentalmente um `configuracoes-updated` (o código emite eventos DOM) para refrescar contextos React.",
            ],
          },
        ],
      },
      {
        id: "cfg-aut",
        title: "Sistema — Automações (`sistema/automacoes`) — PRÓ",
        blocks: [
          {
            t: "p",
            text:
              "Construtor de **regras ECA** (evento-condição-ação): ex. ao receber webhook de pagamento, promover plano. Erros de lógica podem gerar loops — teste em ambiente de baixo volume.",
          },
        ],
      },
      {
        id: "cfg-com",
        title: "Sistema — Comunicador (`sistema/comunicador`) — condicional",
        blocks: [
          {
            t: "p",
            text:
              "Visível apenas quando a plataforma provisiona integração **Evolution API** / WhatsApp para o seu tenant. Permite configurar instâncias, QR de pareamento e templates de mensagem.",
          },
          {
            t: "callout",
            variant: "info",
            title: "Redireccionamento automático",
            body:
              "Se a integração for desactivada a nível global, o painel redirecciona-o para `sistema/configuracoes` ao detectar a página inacessível.",
          },
        ],
      },
      {
        id: "cfg-ano",
        title: "Anotações (`anotacoes`)",
        blocks: [
          {
            t: "p",
            text:
              "**Bloco de notas** persistente por utilizador — ideal para runbooks internos, números de apólice ou lembretes fiscais. Não armazene palavras-passe em claro.",
          },
        ],
      },
      {
        id: "cfg-tic",
        title: "Suporte / Tickets (`tickets`)",
        blocks: [
          {
            t: "p",
            text:
              "Sistema de **ticketing** assíncrono: prioridade, anexos, threads. Utilize-o para bugs, pedidos de feature ou escalonamentos que exijam intervenção humana da operadora.",
          },
        ],
      },
      {
        id: "cfg-plan",
        title: "Planos (`planos`)",
        blocks: [
          {
            t: "p",
            text:
              "Comparação **FREE vs STANDART vs PRÓ**, checkout (tipicamente Mercado Pago) e estado de subscrição. Após pagamento bem-sucedido, o painel dispara `etp-user-plan-refetch` com *backoff* temporal para aguardar webhooks.",
          },
          {
            t: "p",
            text:
              "O escalonamento de plano é a **fonte da verdade** para desbloquear módulos listados com badges ST+ ou PRÓ. Não confie unicamente em cache local do browser.",
          },
        ],
      },
    ],
  },
  {
    id: "matriz-planos",
    title: "Matriz de planos e quotas FREE",
    chunks: [
      {
        id: "matriz-tabela",
        title: "Requisitos mínimos por `page id`",
        blocks: [
          {
            t: "p",
            text:
              "A política de produto codifica três níveis: **FREE** (rank 0), **STANDART** (rank 1), **PRÓ** (rank 2). A função `pageAllowedForPlan` determina se pode renderizar o módulo.",
          },
          {
            t: "ul",
            items: [
              "**PRÓ obrigatório**: `transfer/solicitacoes`, `grupos/solicitacoes`, `motoristas/solicitacoes`, `email-business`, `website`, `dominios`, `sistema/automacoes`.",
              "**STANDART ou superior**: `transfer/contrato`, `grupos/contrato`, `campanhas/ativos`, `campanhas/leads`.",
              "**Sem badge de upgrade** (acesso independente de tier ou regras especiais): `transfer/geolocalizacao`, `disparador`, `empty-legs`, `sistema/comunicador`, `network`, `comunidade`, `mentoria`.",
            ],
          },
          {
            t: "p",
            text:
              "**Quotas numéricas FREE**: reservas diárias (`FREE_MAX_RESERVAS_DIA`), motoristas cadastrados (`FREE_MAX_MOTORISTAS_CADASTRADOS`), links de geolocalização mensais (`FREE_MAX_LINKS_GEO_MES`). Valores exactos residem no código-fonte — consulte-o em ambiente de desenvolvimento se precisar de números atualizados.",
          },
        ],
      },
    ],
  },
  {
    id: "suporte-flutuante",
    title: "Chat de suporte e zoom",
    chunks: [
      {
        id: "chat",
        title: "Suporte no painel",
        blocks: [
          {
            t: "p",
            text:
              "O widget **Chatwoot** (mensagens instantâneas) **não é carregado** neste painel. Para contactar a equipa, use **Suporte** no menu lateral e abra um **ticket**.",
          },
        ],
      },
      {
        id: "zoom",
        title: "PainelContentZoomProvider",
        blocks: [
          {
            t: "p",
            text:
              "O zoom afecta apenas o **viewport interno** do painel — não altera densidade de pixels do sistema operativo. Útil para apresentações em projetor ou acessibilidade visual.",
          },
        ],
      },
    ],
  },
  {
    id: "seguranca-sessao",
    title: "Segurança, sessão e superfície de ataque",
    chunks: [
      {
        id: "seg-auth",
        title: "Autenticação Supabase e armazenamento local",
        blocks: [
          {
            t: "p",
            text:
              "O painel delega **gestão de tokens** ao SDK oficial do Supabase Auth — não copie JWT para `localStorage` arbitrário nem partilhe capturas de ecrã da consola de rede contendo cabeçalhos `Authorization`. A terminação de sessão (`Sair`) revoga o contexto local e invalida o refresh token conforme políticas do fornecedor.",
          },
          {
            t: "p",
            text:
              "Chaves `localStorage` usadas apenas para **preferências de UI** (ex.: aceitação de termos do Network, destaques já vistos) não substituem credenciais. Nunca armazene chaves de API de fornecedores externos em campos de anotações.",
          },
        ],
      },
      {
        id: "seg-upload",
        title: "Uploads e validação binária",
        blocks: [
          {
            t: "p",
            text:
              "Quando carrega logotipos ou anexos, o *backend* valida **magic bytes** — a extensão `.jpg` não é prova de tipo real. Ficheiros maliciosos devem ser bloqueados; se observar erro genérico, verifique integridade do ficheiro e tamanho máximo.",
          },
        ],
      },
      {
        id: "seg-lgpd",
        title: "Minimização e finalidade (RGPD/LGPD)",
        blocks: [
          {
            t: "p",
            text:
              "Cada campo de cliente ou motorista deve ter **finalidade explícita**. Evite duplicar e-mails sensíveis em campos de texto livre; use campos estruturados para permitir anonimização futura.",
          },
        ],
      },
    ],
  },
  {
    id: "interoperabilidade",
    title: "Interoperabilidade, webhooks e PDF",
    chunks: [
      {
        id: "int-webhook",
        title: "Webhooks de motorista e solicitação",
        blocks: [
          {
            t: "p",
            text:
              "Formulários públicos (website / receptivos) frequentemente encadeiam **webhooks** assinados que materializam linhas em `solicitacoes_*`. O painel não mostra o segredo HMAC — apenas o resultado idempotente. Falhas de assinatura aparecem como rejeição silenciosa ou registo em logs server-side.",
          },
        ],
      },
      {
        id: "int-pdf",
        title: "Motor de PDF e contratos",
        blocks: [
          {
            t: "p",
            text:
              "Diversos módulos invocam geradores **jsPDF / html2canvas** para pré-visualizar contratos. O *pixel-perfect* depende de fontes embutidas; divergências entre pré-visualização e PDF final podem surgir por *subpixel anti-aliasing*.",
          },
        ],
      },
      {
        id: "int-mp",
        title: "Gateway de pagamento (visão macro)",
        blocks: [
          {
            t: "p",
            text:
              "Upgrade de plano tipicamente atravessa **Mercado Pago** com redireccionamento e parâmetro `billing=success` na URL de retorno. O painel agenda múltiplos `refetch` do plano para absorver latência de webhooks — não force refresh bruto se o saldo já foi debitado.",
          },
          {
            t: "callout",
            variant: "security",
            title: "Dados financeiros sensíveis",
            body:
              "Nunca cole *access tokens* de gateway, números de cartão completos ou *device IDs* neste manual ou em tickets públicos.",
          },
        ],
      },
    ],
  },
  {
    id: "anti-padroes",
    title: "Anti-padrões e resolução de incidentes",
    chunks: [
      {
        id: "anti-1",
        title: "Sintomas frequentes",
        blocks: [
          {
            t: "ul",
            items: [
              "**Loop de redireccionamento** entre Home e Configurações: indica pendências de onboarding — complete todos os campos obrigatórios.",
              "**Página em branco após upgrade**: limpe cache da aplicação (hard reload) e aguarde propagação de `user_plans`.",
              "**Badge PRÓ persistente**: confirme que o plano na base corresponde a `pro` — a UI normaliza aliases legacy (`premium`, etc.).",
            ],
          },
        ],
      },
      {
        id: "anti-2",
        title: "Telemetria de erros",
        blocks: [
          {
            t: "p",
            text:
              "O painel pode enviar **relatórios anónimos de falha** (`usePainelErrorReporter`) com contexto de rota — útil para suporte, mas não inclua dados pessoais em campos de descrição livre ao abrir ticket.",
          },
        ],
      },
    ],
  },
  {
    id: "glossario",
    title: "Glossário extendido",
    chunks: [
      {
        id: "glos",
        title: "Termos",
        blocks: [
          {
            t: "ul",
            items: [
              "**RLS**: políticas que filtram linhas SQL com base no `auth.uid()` da sessão Supabase.",
              "**Webhook**: notificação HTTP assíncrona assinada criptograficamente — o painel nunca expõe o segredo de assinatura.",
              "**Idempotência**: repetir a mesma acção não duplica efeitos colaterais — crucial em pagamentos.",
              "**Tenant**: instância lógica isolada — aqui, a sua conta.",
              "**Spotlight UI**: overlay modal não bloqueante que guia a primeira interacção com um novo módulo.",
            ],
          },
        ],
      },
    ],
  },
];
