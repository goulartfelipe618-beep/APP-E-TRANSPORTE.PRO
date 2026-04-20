import {
  Mail,
  Globe,
  Search,
  Users,
  BarChart3,
  Car,
  ArrowLeftRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Settings,
  CircleDot,
  Home as HomeIcon,
  Bell,
  Activity,
  MapPin,
  FileText,
  BookOpen,
  ClipboardList,
  UserCheck,
  Plane,
  GraduationCap,
  Megaphone,
  Map,
  Monitor,
  StickyNote,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect, useMemo, type LucideIcon } from "react";
import luxuryCar from "@/assets/luxury-car.jpg";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SlideCarousel from "@/components/SlideCarousel";
import { useActivePage } from "@/contexts/ActivePageContext";
import { toast } from "sonner";
import {
  persistNetworkAceitoNao,
  persistNetworkAceitoSim,
  persistNetworkRetornoSolicitado,
} from "@/lib/networkNacionalPrefs";
import { cn } from "@/lib/utils";
import { usePainelMotoristaEvolutionAtivo } from "@/hooks/usePainelMotoristaEvolutionAtivo";

type ToolDef = { title: string; page: string; desc: string; icon: LucideIcon };

type Subsection = { title: string; items: ToolDef[] };

type MajorSection = {
  id: string;
  label: string;
  /** Destaque âmbar alinhado ao grupo Beta do menu lateral. */
  labelTone?: "beta";
  subsections: Subsection[];
};

function buildHomeSections(showNetwork: boolean, exibirComunicadorMotorista: boolean): MajorSection[] {
  const principal: Subsection[] = [
    {
      title: "Painel",
      items: [
        { title: "Atualizações", page: "atualizacoes", desc: "Novidades da plataforma e avisos importantes.", icon: Bell },
        { title: "Métricas", page: "metricas", desc: "Indicadores e desempenho da operação.", icon: Activity },
        { title: "Abrangência", page: "abrangencia", desc: "Mapa das suas reservas (um PIN por viagem, embarque da primeira partida).", icon: MapPin },
      ],
    },
    {
      title: "Transfer",
      items: [
        { title: "Solicitações", page: "transfer/solicitacoes", desc: "Pedidos e orçamentos de transfer.", icon: FileText },
        { title: "Reservas", page: "transfer/reservas", desc: "Reservas confirmadas e contratos.", icon: BookOpen },
        { title: "Contrato", page: "transfer/contrato", desc: "Modelo de contrato e políticas do produto Transfer.", icon: ClipboardList },
      ],
    },
    {
      title: "Grupos",
      items: [
        { title: "Solicitações", page: "grupos/solicitacoes", desc: "Pedidos para transporte em grupo.", icon: FileText },
        { title: "Reservas", page: "grupos/reservas", desc: "Reservas e valores de grupos.", icon: BookOpen },
        { title: "Contrato", page: "grupos/contrato", desc: "Contrato e termos para grupos.", icon: ClipboardList },
      ],
    },
    {
      title: "Motoristas",
      items: [
        { title: "Cadastros", page: "motoristas/cadastros", desc: "Motoristas parceiros e fichas completas.", icon: UserCheck },
        { title: "Solicitações", page: "motoristas/solicitacoes", desc: "Novos contatos que querem dirigir na operação.", icon: ClipboardList },
      ],
    },
    {
      title: "Frota e oportunidades",
      items: [
        { title: "Veículos", page: "veiculos", desc: "Cadastro e gestão da frota.", icon: Car },
        { title: "Mentoria", page: "mentoria", desc: "Conteúdos e trilha de desenvolvimento.", icon: GraduationCap },
      ],
    },
  ];

  const ferramentasItems: ToolDef[] = [
    { title: "Campanhas — Ativos", page: "campanhas/ativos", desc: "Páginas e campanhas de captação ativas.", icon: Globe },
    { title: "Campanhas — Leads", page: "campanhas/leads", desc: "Leads gerados pelas campanhas.", icon: UserCheck },
    { title: "Geolocalização", page: "transfer/geolocalizacao", desc: "Rastreamento e envio de posição ao cliente.", icon: Map },
    { title: "Receptivos", page: "marketing/receptivos", desc: "Materiais e páginas para receptivo.", icon: Globe },
    { title: "QR Codes", page: "marketing/qrcode", desc: "QR Codes para divulgação e acesso rápido.", icon: Search },
    ...(showNetwork
      ? [{ title: "Network", page: "network", desc: "Oportunidades de viagens com outros motoristas.", icon: Globe } as ToolDef]
      : []),
    { title: "Comunidade", page: "comunidade", desc: "Canal com a comunidade da plataforma.", icon: Users },
    { title: "E-mail Business", page: "email-business", desc: "E-mail profissional com domínio próprio.", icon: Mail },
    { title: "Website", page: "website", desc: "Site institucional integrado à operação.", icon: Monitor },
  ];

  const betaItems: ToolDef[] = [
    { title: "Disparador", page: "disparador", desc: "Envio de mensagens em massa (WhatsApp dedicado).", icon: Megaphone },
    { title: "Catálogo", page: "catalogo", desc: "Catálogo comercial em PDF e materiais para a sua operação.", icon: BookOpen },
    { title: "Google Maps", page: "google", desc: "Presença no Google Meu Negócio e buscas.", icon: MapPin },
    { title: "Empty Legs", page: "empty-legs", desc: "Trechos e oportunidades de retorno.", icon: Plane },
  ];

  const configuracao: Subsection[] = [
    {
      title: "Sistema",
      items: [
        { title: "Configurações", page: "sistema/configuracoes", desc: "Dados da empresa, perfil e preferências.", icon: Settings },
        { title: "Automações", page: "sistema/automacoes", desc: "Webhooks e integrações automatizadas.", icon: Globe },
        ...(exibirComunicadorMotorista
          ? [{ title: "Comunicador", page: "sistema/comunicador", desc: "Canais WhatsApp oficiais e próprios.", icon: Monitor } as ToolDef]
          : []),
      ],
    },
    {
      title: "Suporte interno",
      items: [
        { title: "Anotações", page: "anotacoes", desc: "Notas e lembretes da operação.", icon: StickyNote },
        { title: "Tickets", page: "tickets", desc: "Chamados e solicitações de suporte.", icon: ClipboardList },
      ],
    },
  ];

  return [
    { id: "principal", label: "Principal", subsections: principal },
    {
      id: "ferramentas",
      label: "Ferramentas",
      subsections: [{ title: "Marketing e operação", items: ferramentasItems }],
    },
    {
      id: "beta",
      label: "Beta",
      labelTone: "beta",
      subsections: [{ title: "Recursos em testes", items: betaItems }],
    },
    { id: "config", label: "Configurações", subsections: configuracao },
  ];
}

function ToolCard({ tool, onOpen }: { tool: ToolDef; onOpen: (page: string) => void }) {
  const Icon = tool.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen(tool.page)}
      className={cn(
        "group flex w-full items-start gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all",
        "hover:border-primary/35 hover:bg-muted/40 hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      )}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-foreground/80 ring-1 ring-border/60 group-hover:bg-primary/10 group-hover:text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug text-foreground">{tool.title}</h3>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{tool.desc}</p>
      </div>
    </button>
  );
}

export default function HomePage() {
  const { setActivePage } = useActivePage();
  const { painelMotoristaEvolutionAtivo, ready: painelComunicadorReady } = usePainelMotoristaEvolutionAtivo();
  const exibirComunicadorMotorista = !painelComunicadorReady || painelMotoristaEvolutionAtivo;
  const [networkAceito, setNetworkAceito] = useState<boolean | null>(null);
  const [mostrarRegras, setMostrarRegras] = useState(false);
  const [primeirosPassosConcluidos, setPrimeirosPassosConcluidos] = useState<boolean | null>(null);
  const [menuNetwork, setMenuNetwork] = useState(() => localStorage.getItem("network_nacional_aceito") === "sim");

  const CAMPOS_PERFIL_OBRIGATORIOS = ["nome_completo", "nome_empresa", "cnpj", "telefone", "email", "cidade"];
  const CAMPOS_CONTRATUAIS_OBRIGATORIOS = ["razao_social", "cnpj", "endereco_sede", "telefone", "whatsapp", "email_oficial"];

  const sections = useMemo(
    () => buildHomeSections(menuNetwork, exibirComunicadorMotorista),
    [menuNetwork, exibirComunicadorMotorista],
  );

  const checkPrimeirosPassos = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: perfilData } = await supabase.from("configuracoes" as any).select("*").eq("user_id", user.id).maybeSingle();

    const { data: contratualData } = await supabase.from("cabecalho_contratual" as any).select("*").eq("user_id", user.id).maybeSingle();

    const perfil = (perfilData || {}) as any;
    const contratual = (contratualData || {}) as any;

    const perfilCompleto = CAMPOS_PERFIL_OBRIGATORIOS.every((campo) => perfil[campo] && String(perfil[campo]).trim() !== "");
    const contratualCompleto = CAMPOS_CONTRATUAIS_OBRIGATORIOS.every(
      (campo) => contratual[campo] && String(contratual[campo]).trim() !== "",
    );

    setPrimeirosPassosConcluidos(perfilCompleto && contratualCompleto);
  };

  useEffect(() => {
    checkPrimeirosPassos();

    const handleConfigUpdate = () => {
      checkPrimeirosPassos();
    };

    window.addEventListener("configuracoes-updated", handleConfigUpdate);

    return () => {
      window.removeEventListener("configuracoes-updated", handleConfigUpdate);
    };
  }, []);

  useEffect(() => {
    const syncMenuNetwork = () => {
      setMenuNetwork(localStorage.getItem("network_nacional_aceito") === "sim");
    };
    const checkNetworkStatus = () => {
      const status = localStorage.getItem("network_nacional_aceito");
      const saida = localStorage.getItem("network_saida_data");
      syncMenuNetwork();
      if (status === "sim") {
        setNetworkAceito(true);
      } else if (status === "nao") {
        if (saida) {
          const diff = Date.now() - new Date(saida).getTime();
          const diasPassados = Math.floor(diff / (1000 * 60 * 60 * 24));
          if (diasPassados < 60) {
            setNetworkAceito(false);
          } else {
            setNetworkAceito(null);
          }
        } else {
          setNetworkAceito(false);
        }
      }
    };
    checkNetworkStatus();
    window.addEventListener("network-status-changed", syncMenuNetwork);
    return () => window.removeEventListener("network-status-changed", syncMenuNetwork);
  }, []);

  const handleAceitarNetwork = () => {
    setMostrarRegras(true);
  };

  const handleConfirmarRegras = async () => {
    localStorage.removeItem("network_highlight_shown");
    localStorage.setItem("network_nacional_aceito", "sim");
    const ok = await persistNetworkAceitoSim();
    if (!ok) {
      toast.error("Não foi possível salvar no servidor. A preferência ficou apenas neste dispositivo.");
    }
    setNetworkAceito(true);
    setMenuNetwork(true);
    setMostrarRegras(false);
    window.dispatchEvent(new Event("network-status-changed"));
  };

  const handleRecusarNetwork = async () => {
    localStorage.setItem("network_nacional_aceito", "nao");
    const ok = await persistNetworkAceitoNao();
    if (!ok) {
      toast.error("Não foi possível salvar no servidor. A preferência ficou apenas neste dispositivo.");
    }
    setNetworkAceito(false);
    setMenuNetwork(false);
    window.dispatchEvent(new Event("network-status-changed"));
  };

  const go = (page: string) => setActivePage(page);

  return (
    <div className="space-y-10 pb-8">
      <SlideCarousel
        pagina="home"
        fallbackSlides={[
          {
            titulo: "Impulsione seu Transporte Executivo",
            subtitulo: "Gerencie sua frota, motoristas e corridas com tecnologia de ponta.",
            imagem_url: luxuryCar,
          },
        ]}
      />

      {/* Intro estilo landing, alinhada ao layout do sistema */}
      <div className="rounded-2xl border border-border/80 bg-gradient-to-b from-card to-card/40 px-6 py-8 shadow-sm sm:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <HomeIcon className="h-3.5 w-3.5 text-primary" aria-hidden />
            Início
          </div>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Central da sua operação</h1>
          <p className="mt-3 text-pretty text-muted-foreground sm:text-lg">
            Acesse abaixo todas as áreas do painel — mesma estrutura do menu lateral — com atalhos diretos para cada ferramenta.
          </p>
        </div>
      </div>

      {primeirosPassosConcluidos === false && (
        <div className="space-y-4 rounded-xl border-2 border-amber-500/50 bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/10 p-3">
              <Settings className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Primeiros passos</h3>
              <p className="text-sm text-muted-foreground">Complete as etapas abaixo para começar a usar a plataforma</p>
            </div>
          </div>
          <div className="space-y-3">
            <div
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 transition-colors hover:bg-amber-500/10"
              onClick={() => setActivePage("sistema/configuracoes")}
              onKeyDown={(e) => e.key === "Enter" && setActivePage("sistema/configuracoes")}
              role="button"
              tabIndex={0}
            >
              <div className="rounded-full border-2 border-amber-500 p-1.5">
                <CircleDot className="h-4 w-4 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Preencha suas configurações</p>
                <p className="text-xs text-muted-foreground">
                  Acesse Sistema → Configurações e preencha todos os campos obrigatórios (nome, empresa, CNPJ, telefone, e-mail, endereço, cidade e estado).
                </p>
              </div>
              <Badge variant="outline" className="border-amber-500/50 text-amber-500">
                Pendente
              </Badge>
            </div>
          </div>
        </div>
      )}

      {networkAceito === null && !mostrarRegras && (
        <div className="space-y-4 rounded-xl border-2 border-primary/50 bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Network Nacional E-Transporte.pro</h3>
              <p className="text-sm text-muted-foreground">Programa de atendimento corporativo nacional</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Deseja fazer parte do sistema de <strong className="text-foreground">Network Nacional</strong> da E-Transporte.pro? Ao participar, você poderá receber solicitações de atendimento corporativo de empresas parceiras em sua região.
          </p>
          <div className="flex gap-3">
            <Button onClick={handleAceitarNetwork} className="bg-primary text-primary-foreground">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Sim, quero participar
            </Button>
            <Button variant="outline" onClick={handleRecusarNetwork}>
              Não, obrigado
            </Button>
          </div>
        </div>
      )}

      {mostrarRegras && (
        <div className="space-y-5 rounded-xl border-2 border-destructive/50 bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-destructive/10 p-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Termos obrigatórios — Network Nacional</h3>
              <Badge variant="destructive" className="mt-1">
                Leitura obrigatória
              </Badge>
            </div>
          </div>

          <div className="max-h-80 space-y-4 overflow-y-auto rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
            <div>
              <h4 className="mb-1 font-bold text-foreground">1. Obrigatoriedade de atendimento</h4>
              <p>
                Todas as solicitações enviadas para você através do Network Nacional <strong className="text-foreground">deverão ser obrigatoriamente realizadas por você</strong>. Caso não consiga realizar o atendimento pessoalmente,{" "}
                <strong className="text-foreground">deverá ser realizado por um parceiro seu</strong>, e você será o responsável integral por esse atendimento.
              </p>
            </div>

            <div>
              <h4 className="mb-1 font-bold text-foreground">2. Penalização por descumprimento</h4>
              <p>
                O não cumprimento de qualquer solicitação resultará em <strong className="text-destructive">perda imediata do acesso ao sistema</strong> e <strong className="text-destructive">quebra da relação com a E-Transporte.pro</strong>. Não haverá tolerância para descumprimentos.
              </p>
            </div>

            <div>
              <h4 className="mb-1 font-bold text-foreground">3. Atendimento alto padrão — indispensável</h4>
              <p>
                O motorista que faz parte do Network Nacional <strong className="text-foreground">deve manter um atendimento de altíssimo padrão</strong> em todas as corridas: pontualidade, cordialidade, veículo limpo e em boas condições, vestimenta adequada, discrição e profissionalismo.
              </p>
            </div>

            <div>
              <h4 className="mb-1 font-bold text-destructive">4. Proibição total de troca de contatos</h4>
              <p className="font-semibold text-foreground">É totalmente proibido solicitar, oferecer ou trocar qualquer contato com o passageiro (telefone, WhatsApp, e-mail, redes sociais ou outros).</p>
              <p>
                O descumprimento resultará em <strong className="text-destructive">desligamento imediato do sistema sem possibilidade de retorno</strong>.
              </p>
            </div>

            <div>
              <h4 className="mb-1 font-bold text-foreground">5. Representação da marca</h4>
              <p>
                Ao aceitar este termo, você representa a E-Transporte.pro perante clientes corporativos. Condutas inadequadas serão tratadas com rigor.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleConfirmarRegras} className="bg-primary text-primary-foreground">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Li e aceito todos os termos
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setMostrarRegras(false);
              }}
            >
              Voltar
            </Button>
          </div>
        </div>
      )}

      {networkAceito === true && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Você faz parte do Network Nacional E-Transporte.pro</p>
            <p className="text-xs text-muted-foreground">Seus termos foram aceitos. Mantenha o padrão de excelência.</p>
          </div>
        </div>
      )}

      {networkAceito === false && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Você optou por não participar do Network Nacional.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              localStorage.removeItem("network_nacional_aceito");
              localStorage.removeItem("network_saida_data");
              localStorage.removeItem("network_highlight_shown");
              const ok = await persistNetworkRetornoSolicitado();
              if (!ok) {
                toast.error("Não foi possível atualizar no servidor.");
              }
              setNetworkAceito(null);
              setMenuNetwork(false);
              window.dispatchEvent(new Event("network-status-changed"));
            }}
          >
            Reconsiderar
          </Button>
        </div>
      )}

      {/* Mapa completo de ferramentas — espelha o menu lateral */}
      <div className="space-y-12">
        <div className="border-b border-border pb-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Todas as ferramentas</h2>
          <p className="mt-2 max-w-2xl mx-auto text-muted-foreground">
            Atalhos para cada item do painel. A mesma lista está organizada no menu à esquerda.
          </p>
        </div>

        {sections.map((major) => (
          <section key={major.id} className="space-y-8" aria-labelledby={`section-${major.id}`}>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <h2
                id={`section-${major.id}`}
                className={cn(
                  "text-xl font-bold text-foreground",
                  major.labelTone === "beta" &&
                    "uppercase tracking-wide text-amber-600 dark:text-amber-400",
                )}
              >
                {major.label}
              </h2>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Acesso rápido</span>
            </div>

            {major.subsections.map((sub) => (
              <div key={`${major.id}-${sub.title}`} className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{sub.title}</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {sub.items.map((tool) => (
                    <ToolCard key={`${tool.page}-${tool.title}`} tool={tool} onOpen={go} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>

      <footer className="rounded-2xl border border-border bg-card px-6 py-8 text-center">
        <p className="font-semibold text-foreground">E-Transporte.pro — plataforma completa para transporte executivo</p>
        <p className="mt-2 text-sm text-muted-foreground">Gestão de frota, marketing digital, network e integrações. Tudo em um só lugar.</p>
      </footer>
    </div>
  );
}
