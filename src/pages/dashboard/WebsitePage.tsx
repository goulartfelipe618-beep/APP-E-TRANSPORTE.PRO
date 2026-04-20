import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, ArrowRight, Eye, Check, Upload, Monitor, LayoutTemplate, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { assertUploadMagicBytes, extensionForDetectedMime } from "@/lib/validateUploadMagicBytes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CheckCircle2, Info } from "lucide-react";
import SlideCarousel from "@/components/SlideCarousel";
import { useUserPlan } from "@/hooks/useUserPlan";
import UpgradePlanDialog from "@/components/planos/UpgradePlanDialog";
import { useActivePage } from "@/contexts/ActivePageContext";
import { usePurchasedDomains } from "@/hooks/usePurchasedDomains";
import {
  PurchasedDomainSelectStep,
  REGISTER_NEW_DOMAIN_VALUE,
} from "@/components/domain/PurchasedDomainSelectStep";

interface TemplateDB {
  id: string;
  nome: string;
  imagem_url: string;
  link_modelo: string;
  ordem: number;
  ativo: boolean;
}

// ── Options ──────────────────────────────────────────
const SERVICE_TYPES = [
  "Transfer aeroporto", "Transfer hotel", "Transporte executivo", "Transporte corporativo",
  "Transporte para eventos", "Excursões", "City tour", "Transporte para casamentos",
  "Transporte para grupos", "Transporte para shows/festas", "Transporte para parques",
];

const VEHICLE_AMENITIES = [
  "Ar-condicionado", "Wi-Fi", "Água para passageiros", "Banco de couro", "Carregador USB",
];

const DIFFERENTIALS = [
  "Motorista bilíngue", "Atendimento 24h", "Monitoramento de voo", "Pontualidade garantida",
  "Veículos novos", "Atendimento VIP", "Transporte seguro",
];

const AUDIENCE_OPTIONS = [
  "Turistas", "Empresários", "Famílias", "Grupos", "Eventos corporativos",
  "Agências de turismo", "Hotéis",
];

const PAYMENT_OPTIONS = ["PIX", "Cartão crédito", "Cartão débito", "Dinheiro", "Link de pagamento"];

const BOOKING_OPTIONS = ["WhatsApp", "Formulário no site", "Sistema automático", "Link direto de pagamento"];

const LANGUAGE_OPTIONS = ["Português", "Inglês", "Espanhol"];

const PAGE_OPTIONS = [
  "Página inicial", "Sobre a empresa", "Serviços", "Frota",
  "Destinos atendidos", "Blog", "Depoimentos de clientes",
];

const INTEGRATION_OPTIONS = [
  "WhatsApp", "Google Maps", "Instagram", "Sistema de reservas",
];

const EMAIL_REGISTER_VALUE = "__email_business_cadastrar__";
const EMAIL_LATER_VALUE = "__email_depois__";

function resolveWebsiteTemplatePreviewUrl(dados: Record<string, unknown> | null | undefined, templates: TemplateDB[]): string | null {
  const fromData = typeof dados?.template_imagem_url === "string" ? dados.template_imagem_url.trim() : "";
  if (fromData) return fromData;
  const tid = dados?.template_id;
  if (typeof tid === "string") {
    const t = templates.find((x) => x.id === tid);
    if (t?.imagem_url) return t.imagem_url;
  }
  return null;
}

function websiteMotoristaStatusPresentation(status: string, linkAcesso: string | null | undefined): {
  headline: string;
  description: string;
} {
  if (status === "pendente") {
    return {
      headline: "Em análise",
      description: "Recebemos seu briefing. Nossa equipe está analisando as informações antes de seguir com a produção.",
    };
  }
  if (status === "em_andamento") {
    return {
      headline: "Em desenvolvimento",
      description: "Seu site está sendo produzido com base no modelo e no conteúdo enviados.",
    };
  }
  if (status === "publicado") {
    return {
      headline: "Website publicado",
      description: "Seu site já está no ar. Use o botão abaixo para abrir a versão publicada.",
    };
  }
  if (status === "concluido") {
    return {
      headline: linkAcesso ? "Website publicado" : "Concluído",
      description: linkAcesso
        ? "Seu projeto foi finalizado. Acesse o link abaixo quando desejar."
        : "Seu pedido foi concluído. Em breve você receberá o link de acesso, se ainda não estiver disponível.",
    };
  }
  if (status === "recusado") {
    return {
      headline: "Solicitação não aprovada",
      description: "Entre em contato com o suporte para mais detalhes ou envie um novo pedido quando for possível.",
    };
  }
  return { headline: status, description: "" };
}

function formatVehicleLineFromWebhook(dw: unknown): string | null {
  if (!dw || typeof dw !== "object") return null;
  const o = dw as Record<string, unknown>;
  if (o.possui_veiculo === false) return null;
  const marca = String(o.marca_veiculo ?? "").trim();
  const modelo = String(o.modelo_veiculo ?? "").trim();
  const ano = String(o.ano_veiculo ?? "").trim();
  const placa = String(o.placa_veiculo ?? "").trim();
  const cor = String(o.cor_veiculo ?? "").trim();
  if (!marca && !modelo && !placa) return null;
  const parts = [marca, modelo].filter(Boolean).join(" ");
  const suffix = [ano ? `(${ano})` : "", placa ? `— ${placa}` : "", cor ? `— ${cor}` : ""].filter(Boolean).join(" ");
  return suffix ? `${parts} ${suffix}`.trim() : parts || null;
}

const STYLE_OPTIONS = ["Minimalista", "Luxo", "Corporativo", "Moderno", "Turístico"];

const PLATFORM_OPTIONS = ["Uber Black", "99", "InDriver", "Particular"];

const PRICE_OPTIONS = ["Econômico", "Intermediário", "Premium", "Luxo"];

// ── Steps config ─────────────────────────────────────
const STEPS = [
  { n: 1, label: "Marca" },
  { n: 2, label: "Empresa" },
  { n: 3, label: "Serviços" },
  { n: 4, label: "Aeroportos" },
  { n: 5, label: "Frota" },
  { n: 6, label: "Diferenciais" },
  { n: 7, label: "Público" },
  { n: 8, label: "Pagamentos" },
  { n: 9, label: "Redes" },
  { n: 10, label: "Idiomas" },
  { n: 11, label: "Páginas" },
  { n: 12, label: "SEO" },
  { n: 13, label: "Integrações" },
  { n: 14, label: "Conteúdo" },
  { n: 15, label: "Enviar" },
];

// ── Helper: toggle in array ──────────────────────────
function toggle(arr: string[], val: string) {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
}

// ── Checkbox Group Component ─────────────────────────
function CheckboxGroup({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map(o => (
        <label key={o} className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={selected.includes(o)} onCheckedChange={() => onChange(toggle(selected, o))} />
          <span className="text-sm text-foreground">{o}</span>
        </label>
      ))}
    </div>
  );
}

// ── Section Card ─────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════
export default function WebsitePage() {
  const { setActivePage } = useActivePage();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [step, setStep] = useState<"gallery" | "domain_pick" | "briefing" | "acompanhamento">("gallery");
  const [bs, setBs] = useState(1); // briefing step
  const [submitting, setSubmitting] = useState(false);
  const [servicoAtivo, setServicoAtivo] = useState<any>(null);
  const [dbTemplates, setDbTemplates] = useState<TemplateDB[]>([]);
  const { plano, refetch: refetchPlano } = useUserPlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  /** Domínio escolhido na etapa dedicada (lista de comprados ou fluxo legado). */
  const [domain, setDomain] = useState("");
  const [domainOption, setDomainOption] = useState<"new" | "existing">("existing");
  const [purchasedDomainId, setPurchasedDomainId] = useState<string | null>(null);
  const [provider, setProvider] = useState("");

  const [domainPickSelect, setDomainPickSelect] = useState<string>("");
  const domainPickEnabled = step === "domain_pick" && !!selectedTemplate;
  const { domains: purchasedDomains, loading: domainPickLoading } = usePurchasedDomains(domainPickEnabled);

  // Step 2 - Empresa
  const [companyName, setCompanyName] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [telefoneSecundario, setTelefoneSecundario] = useState("");
  const [professionalEmailChoice, setProfessionalEmailChoice] = useState("");
  const [emailBusinessEmails, setEmailBusinessEmails] = useState<string[]>([]);
  const [cnpj, setCnpj] = useState("");
  const [cidadeSede, setCidadeSede] = useState("");
  const [regiaoAtendida, setRegiaoAtendida] = useState("");
  /** '' até escolher; obrigatório na etapa Marca */
  const [logoChoice, setLogoChoice] = useState<"" | "sim" | "nao">("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [preferredColors, setPreferredColors] = useState("");
  const [desiredStyle, setDesiredStyle] = useState("Minimalista");

  // Step 3 - Serviços
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [servicoOutro, setServicoOutro] = useState("");

  // Step 4 - Aeroportos e destinos
  const [aeroportos, setAeroportos] = useState("");
  const [rotas, setRotas] = useState("");

  // Step 5 - Frota (cadastro em Motoristas → Cadastros)
  const [veiculos, setVeiculos] = useState("");
  const [amenidades, setAmenidades] = useState<string[]>([]);
  const [cadastroVeiculos, setCadastroVeiculos] = useState<{ id: string; label: string }[]>([]);
  const [veiculosSelecionadosIds, setVeiculosSelecionadosIds] = useState<string[]>([]);

  // Step 6 - Diferenciais
  const [diferenciais, setDiferenciais] = useState<string[]>([]);
  const [diferencialPrincipal, setDiferencialPrincipal] = useState("");

  // Step 7 - Público
  const [publicoAlvo, setPublicoAlvo] = useState<string[]>([]);
  const [faixaPreco, setFaixaPreco] = useState("Premium");

  // Step 8 - Pagamentos e reservas
  const [pagamentos, setPagamentos] = useState<string[]>([]);
  const [formasReserva, setFormasReserva] = useState<string[]>([]);

  // Step 9 - Redes sociais
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [googleBusiness, setGoogleBusiness] = useState("");
  const [tripAdvisor, setTripAdvisor] = useState("");

  // Step 10 - Idiomas
  const [idiomas, setIdiomas] = useState<string[]>(["Português"]);

  // Step 11 - Páginas do site
  const [paginas, setPaginas] = useState<string[]>(PAGE_OPTIONS.slice(0, 4));

  // Step 12 - SEO
  const [palavrasChave, setPalavrasChave] = useState("");

  // Step 13 - Integrações
  const [integracoes, setIntegracoes] = useState<string[]>(["WhatsApp"]);

  // Step 14 - Conteúdo
  const [temFotosCidade, setTemFotosCidade] = useState(false);
  const [temFotosVeiculos, setTemFotosVeiculos] = useState(false);
  const [temFotosMotorista, setTemFotosMotorista] = useState(false);
  const [temVideos, setTemVideos] = useState(false);
  const [plataformas, setPlataformas] = useState<string[]>([]);
  const [horarioAtendimento, setHorarioAtendimento] = useState("24 horas");
  const [depoimentos, setDepoimentos] = useState("");

  // ── Data fetch ─────────────────────────────────────
  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await (supabase.from("templates_website" as any).select("*").eq("ativo", true).order("ordem", { ascending: true }) as any);
      if (data) setDbTemplates(data);
    };
    fetchTemplates();
  }, []);

  useEffect(() => {
    setPaginas((p) => p.filter((x) => PAGE_OPTIONS.includes(x)));
    setIntegracoes((i) => i.filter((x) => INTEGRATION_OPTIONS.includes(x)));
  }, []);

  useEffect(() => {
    if (step !== "briefing") return;
    let cancelled = false;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: svcRows } = await supabase
        .from("solicitacoes_servicos" as any)
        .select("dados_solicitacao")
        .eq("user_id", user.id)
        .eq("tipo_servico", "email") as any;

      const emails = new Set<string>();
      for (const row of (svcRows as { dados_solicitacao: unknown }[] | null) || []) {
        const ds = row.dados_solicitacao as { email_principal?: string } | null;
        const e = typeof ds?.email_principal === "string" ? ds.email_principal.trim() : "";
        if (e) emails.add(e);
      }
      if (!cancelled) setEmailBusinessEmails([...emails].sort());

      const { data: motRows } = await supabase
        .from("solicitacoes_motoristas")
        .select("id, dados_webhook")
        .eq("user_id", user.id)
        .eq("status", "cadastrado");

      const list: { id: string; label: string }[] = [];
      for (const m of motRows || []) {
        const line = formatVehicleLineFromWebhook(m.dados_webhook);
        if (line) list.push({ id: m.id, label: line });
      }
      if (!cancelled) setCadastroVeiculos(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  const refreshWebsiteSolicitacao = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await (supabase.from("solicitacoes_servicos" as any).select("*").eq("user_id", user.id).eq("tipo_servico", "website").order("created_at", { ascending: false }).limit(1) as any);
    if (!data?.length) {
      setServicoAtivo(null);
      setStep("gallery");
      return;
    }
    const s = data[0];
    if (s.status === "recusado") {
      setServicoAtivo(null);
      setStep("gallery");
      return;
    }
    setServicoAtivo(s);
    if (["pendente", "em_andamento", "publicado", "concluido"].includes(s.status)) {
      setStep("acompanhamento");
    }
  }, []);

  useEffect(() => {
    void refreshWebsiteSolicitacao();
  }, [refreshWebsiteSolicitacao]);

  useEffect(() => {
    if (step !== "acompanhamento" || !servicoAtivo?.id) return;
    const ch = supabase
      .channel(`website-solicitacao-${servicoAtivo.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "solicitacoes_servicos",
          filter: `id=eq.${servicoAtivo.id}`,
        },
        () => {
          void refreshWebsiteSolicitacao();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [step, servicoAtivo?.id, refreshWebsiteSolicitacao]);

  useEffect(() => {
    if (step !== "acompanhamento") return;
    const onFocus = () => void refreshWebsiteSolicitacao();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [step, refreshWebsiteSolicitacao]);

  const selectedTemplateName = dbTemplates.find(t => t.id === selectedTemplate)?.nome || "";

  /** Apenas marca o template na galeria; o utilizador confirma com "Continuar com modelo escolhido". */
  const selectTemplateOnly = (templateId: string) => {
    setSelectedTemplate(templateId);
  };

  /** Após seleção visual na galeria, avança para a etapa de domínio. */
  const continueWithSelectedTemplate = () => {
    if (!selectedTemplate) {
      toast.error("Selecione um modelo primeiro.");
      return;
    }
    if (plano === "free") {
      setUpgradeOpen(true);
      return;
    }
    setDomainPickSelect("");
    setPurchasedDomainId(null);
    setDomain("");
    setDomainOption("existing");
    setProvider("");
    setStep("domain_pick");
  };

  const handleSubmitSolicitacao = async () => {
    if (!professionalEmailChoice) {
      toast.error("Selecione o e-mail profissional ou uma opção da lista.");
      return;
    }
    if (!logoChoice) {
      toast.error("Indique se você possui logotipo.");
      return;
    }
    if (logoChoice === "sim" && !logoFile) {
      toast.error("Envie o arquivo da logo antes de enviar o briefing.");
      return;
    }
    const linhasCadastroCheck = veiculosSelecionadosIds
      .map((id) => cadastroVeiculos.find((c) => c.id === id)?.label)
      .filter((x): x is string => !!x);
    if (linhasCadastroCheck.length === 0 && !veiculos.trim()) {
      toast.error("Informe ao menos um veículo (cadastro ou descrição) na etapa Frota.");
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não autenticado"); setSubmitting(false); return; }

    let logoUrl: string | null = null;
    if (logoChoice === "sim" && logoFile) {
      let ext = "png";
      try {
        const { mime } = await assertUploadMagicBytes(logoFile, "raster-or-pdf", 12 * 1024 * 1024);
        ext = extensionForDetectedMime(mime);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Logo inválida");
        setSubmitting(false);
        return;
      }
      const path = `${user.id}/${Date.now()}-logo.${ext}`;
      const { error: upErr } = await supabase.storage.from("website-briefing").upload(path, logoFile, {
        upsert: false,
        cacheControl: "3600",
      });
      if (upErr) {
        toast.error("Não foi possível enviar a logo.", { description: upErr.message });
        setSubmitting(false);
        return;
      }
      const { data: pub } = supabase.storage.from("website-briefing").getPublicUrl(path);
      logoUrl = pub.publicUrl;
    }

    const emailProfissional =
      professionalEmailChoice === EMAIL_LATER_VALUE ? "" : professionalEmailChoice;
    const emailProfissionalOpcao =
      professionalEmailChoice === EMAIL_LATER_VALUE ? "cadastrar_depois" : "selecionado";

    const linhasCadastro = veiculosSelecionadosIds
      .map((id) => cadastroVeiculos.find((c) => c.id === id)?.label)
      .filter((x): x is string => !!x);
    const veiculosTextoMerged = [...linhasCadastro, veiculos.trim()].filter(Boolean).join("\n");

    const tmpl = dbTemplates.find((t) => t.id === selectedTemplate);

    const { data: inserted, error } = await (supabase.from("solicitacoes_servicos" as any).insert({
      user_id: user.id,
      tipo_servico: "website",
      status: "pendente",
        dados_solicitacao: {
        template: selectedTemplateName, template_id: selectedTemplate,
        template_imagem_url: tmpl?.imagem_url ?? null,
        dominio: domain,
        dominio_usuario_id: purchasedDomainId,
        tipo_dominio: domainOption,
        provedor: provider,
        possui_dominio: domainOption === "existing",
        nome_empresa: companyName, responsavel, whatsapp, telefone_secundario: telefoneSecundario,
        email: emailProfissional,
        email_profissional_opcao: emailProfissionalOpcao,
        cnpj, cidade_sede: cidadeSede, regiao_atendida: regiaoAtendida,
        possui_logo: logoChoice === "sim",
        logo_url: logoUrl,
        sem_logo_arquivo: logoChoice === "nao",
        cores_preferidas: preferredColors, estilo: desiredStyle,
        servicos: selectedServices, servico_outro: servicoOutro,
        aeroportos, rotas_principais: rotas,
        veiculos: veiculosTextoMerged,
        veiculos_cadastro_ids: veiculosSelecionadosIds,
        amenidades_veiculos: amenidades,
        diferenciais, diferencial_principal: diferencialPrincipal,
        publico_alvo: publicoAlvo, faixa_preco: faixaPreco,
        pagamentos, formas_reserva: formasReserva,
        redes_sociais: { instagram, facebook, google_business: googleBusiness, tripadvisor: tripAdvisor },
        idiomas, paginas_site: paginas, palavras_chave_seo: palavrasChave, integracoes,
        conteudo: { fotos_cidade: temFotosCidade, fotos_veiculos: temFotosVeiculos, fotos_motorista: temFotosMotorista, videos: temVideos },
        plataformas, horario_atendimento: horarioAtendimento, depoimentos,
      },
    } as any).select().single() as any);
    setSubmitting(false);
    if (error) { toast.error("Erro ao enviar: " + error.message); return; }
    toast.success("Briefing enviado! Acompanhe o status desta página.");
    setBs(1);
    setSelectedTemplate(null);
    if (inserted) {
      setServicoAtivo(inserted);
      setStep("acompanhamento");
    } else {
      void refreshWebsiteSolicitacao();
    }
  };

  // ── Pós-briefing: resumo + mockup (galeria de modelos bloqueada) ──
  if (step === "acompanhamento" && servicoAtivo) {
    const dados = (servicoAtivo.dados_solicitacao || {}) as Record<string, unknown>;
    const previewUrl = resolveWebsiteTemplatePreviewUrl(dados, dbTemplates);
    const { headline, description } = websiteMotoristaStatusPresentation(servicoAtivo.status, servicoAtivo.link_acesso);
    const emailProf =
      dados.email_profissional_opcao === "cadastrar_depois"
        ? "Vou cadastrar depois"
        : (typeof dados.email === "string" && dados.email.trim() ? dados.email : "—");
    const linkPublicado = typeof servicoAtivo.link_acesso === "string" ? servicoAtivo.link_acesso.trim() : "";
    const exibirBotaoSitePublicado =
      linkPublicado.length > 0 &&
      (servicoAtivo.status === "publicado" || servicoAtivo.status === "concluido");

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Monitor className="h-7 w-7 text-primary" /> Website — Acompanhamento do projeto
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Seu briefing já foi enviado. A escolha de novos modelos na galeria fica bloqueada enquanto este projeto estiver em andamento.
          </p>
        </div>

        <div className="w-full rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:items-stretch divide-y lg:divide-y-0 lg:divide-x divide-border">
            {/* Coluna mockup */}
            <div className="flex flex-col p-6 sm:p-8 lg:min-h-[28rem]">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2 mb-4">
                <LayoutTemplate className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Modelo escolhido
              </p>
              <div className="flex flex-1 min-h-0 items-center justify-center">
                <div
                  className={cn(
                    "relative w-full max-w-[min(100%,20rem)] sm:max-w-[22rem] overflow-hidden rounded-lg border border-border/80 bg-muted",
                    "aspect-square shadow-inner",
                  )}
                >
                  {previewUrl ? (
                    <div className="group relative h-full w-full cursor-ns-resize overflow-hidden rounded-lg">
                      <img
                        src={previewUrl}
                        alt={typeof dados.template === "string" ? dados.template : "Prévia do modelo"}
                        className="h-[200%] w-full object-cover object-top transition-transform duration-[50s] ease-linear group-hover:-translate-y-[min(45%,12rem)]"
                      />
                      <p className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-background/95 px-3 py-1 text-[10px] text-muted-foreground shadow-sm border border-border">
                        Passe o mouse para simular rolagem
                      </p>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[200px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
                      Prévia indisponível. O modelo registrado:{" "}
                      <span className="font-medium text-foreground">{String(dados.template || "—")}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Coluna status + resumo */}
            <div className="flex flex-col gap-5 p-6 sm:p-8 bg-muted/20 lg:bg-muted/10">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status do projeto</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-base px-3 py-1",
                    servicoAtivo.status === "publicado" || (servicoAtivo.status === "concluido" && linkPublicado)
                      ? "border-green-500/40 bg-green-500/10 text-green-900 dark:text-green-100"
                      : servicoAtivo.status === "em_andamento"
                        ? "border-blue-500/40 bg-blue-500/10 text-blue-900 dark:text-blue-100"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100",
                  )}
                >
                  {servicoAtivo.status === "publicado" || (servicoAtivo.status === "concluido" && linkPublicado) ? (
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {headline}
                </Badge>
              </div>
              {description ? <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{description}</p> : null}
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-semibold text-foreground mb-3">Resumo do briefing</p>
              <dl className="grid gap-2 text-sm">
                {[
                  ["Modelo", String(dados.template || "—")],
                  ["Domínio", String(dados.dominio || "—")],
                  ["Empresa", String(dados.nome_empresa || "—")],
                  ["WhatsApp", String(dados.whatsapp || "—")],
                  ["E-mail profissional", emailProf],
                  ["Cidade / região", [dados.cidade_sede, dados.regiao_atendida].filter(Boolean).join(" · ") || "—"],
                  ["Estilo", String(dados.estilo || "—")],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-border/60 pb-2 last:border-0">
                    <dt className="text-muted-foreground shrink-0">{k}</dt>
                    <dd className="text-foreground text-right font-medium break-words">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {exibirBotaoSitePublicado ? (
              <Button type="button" size="lg" className="w-full gap-2" asChild>
                <a href={linkPublicado} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Visualizar site publicado
                </a>
              </Button>
            ) : null}

            {servicoAtivo.observacoes_admin ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium text-foreground flex items-center gap-1 mb-1"><Info className="h-4 w-4" /> Observações da equipe</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{servicoAtivo.observacoes_admin}</p>
              </div>
            ) : null}

            {servicoAtivo.instrucoes_acesso ? (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap border-t border-border pt-4">
                <span className="font-medium text-foreground">Instruções: </span>
                {servicoAtivo.instrucoes_acesso}
              </div>
            ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const goToDomainMenu = () => setActivePage("dominios");

  if (step === "domain_pick" && selectedTemplate) {
    return (
      <>
        <UpgradePlanDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
        <div className="space-y-8 max-w-lg">
          <PurchasedDomainSelectStep
            domains={purchasedDomains}
            loading={domainPickLoading}
            value={domainPickSelect}
            onValueChange={(id, row) => {
              setDomainPickSelect(id);
              if (row) {
                setDomain(row.fqdn);
                setPurchasedDomainId(row.id);
                setDomainOption("existing");
                setProvider("");
              }
            }}
            onRegisterNew={goToDomainMenu}
          />

          <div className="flex items-center justify-between pt-4">
            <Button type="button" variant="outline" onClick={() => setStep("gallery")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!domainPickSelect || domainPickSelect === REGISTER_NEW_DOMAIN_VALUE) {
                  toast.error("Selecione um domínio já cadastrado ou registre um novo no menu Domínios.");
                  return;
                }
                if (plano === "free") {
                  setUpgradeOpen(true);
                  return;
                }
                setStep("briefing");
                setBs(1);
              }}
            >
              Continuar <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </>
    );
  }

  // ── Briefing view ──────────────────────────────────
  if (step === "briefing") {
    return (
      <>
        <UpgradePlanDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Website — Briefing Completo</h1>
            <p className="text-sm text-muted-foreground">
              Modelo escolhido: <span className="font-semibold text-foreground">{selectedTemplateName}</span>
              <span className="text-muted-foreground"> (definido antes do domínio; após enviar o briefing não será possível trocar o modelo pela galeria)</span>
            </p>
          </div>

          {/* Stepper */}
          <div className="flex flex-wrap gap-1 text-xs">
            {STEPS.map((s) => (
              <div key={s.n} className={cn(
                "px-2.5 py-1 rounded-full font-medium cursor-pointer transition-colors",
                bs === s.n ? "bg-primary text-primary-foreground" : bs > s.n ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )} onClick={() => { if (s.n <= bs) setBs(s.n); }}>
                {s.n}. {s.label}
              </div>
            ))}
          </div>

          {/* ── STEP 1: Marca (somente identidade visual; domínio foi na etapa anterior) ── */}
          {bs === 1 && (
            <div className="rounded-xl border border-border bg-card p-8 space-y-0">
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-foreground">🏷️ Marca</h2>
                <p className="text-sm text-muted-foreground -mt-2">
                  Domínio do site: <span className="font-medium text-foreground">{domain || "—"}</span>{" "}
                  <button type="button" onClick={() => setStep("domain_pick")} className="text-primary hover:underline">
                    Alterar domínio
                  </button>
                </p>
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-foreground">Possui logotipo? *</Label>
                  <RadioGroup
                    value={logoChoice || undefined}
                    onValueChange={(v) => {
                      const next = v as "sim" | "nao";
                      setLogoChoice(next);
                      if (next === "nao") setLogoFile(null);
                    }}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 has-[[data-state=checked]]:border-primary">
                      <RadioGroupItem value="sim" id="logo-sim" />
                      <span className="text-sm text-foreground">SIM, já possuo</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 has-[[data-state=checked]]:border-primary">
                      <RadioGroupItem value="nao" id="logo-nao" />
                      <span className="text-sm text-foreground">NÃO</span>
                    </label>
                  </RadioGroup>
                </div>
                {logoChoice === "sim" && (
                  <div>
                    <Label className="text-sm font-medium text-foreground">Upload da logo *</Label>
                    <label className="mt-1.5 flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 transition-colors hover:bg-muted">
                      <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm text-muted-foreground">
                        {logoFile ? logoFile.name : "Selecionar imagem (PNG, JPG, SVG…)"}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">Envio obrigatório quando você possui logotipo.</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Cores da marca</label>
                    <Input
                      value={preferredColors}
                      onChange={(e) => setPreferredColors(e.target.value)}
                      placeholder="Preto e dourado, azul marinho..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Estilo visual desejado</label>
                    <Select value={desiredStyle} onValueChange={setDesiredStyle}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STYLE_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Empresa ── */}
          {bs === 2 && (
            <Section title="🏢 Informações da Empresa">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-foreground">Nome da empresa *</label><Input value={companyName} onChange={e => setCompanyName(e.target.value)} className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">Nome do responsável</label><Input value={responsavel} onChange={e => setResponsavel(e.target.value)} className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">WhatsApp principal *</label><Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(47) 99999-9999" className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">Telefone secundário</label><Input value={telefoneSecundario} onChange={e => setTelefoneSecundario(e.target.value)} className="mt-1" /></div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-foreground">E-mail profissional *</label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
                    Lista dos e-mails solicitados em Ferramentas → E-mail Business. Você também pode cadastrar depois ou abrir o fluxo de cadastro.
                  </p>
                  <Select
                    value={professionalEmailChoice || undefined}
                    onValueChange={(v) => {
                      if (v === EMAIL_REGISTER_VALUE) {
                        setActivePage("email-business");
                        toast.message("E-mail Business", {
                          description: "Após cadastrar, volte ao Website e atualize esta lista (reabra o passo ou a página).",
                        });
                        return;
                      }
                      setProfessionalEmailChoice(v);
                    }}
                  >
                    <SelectTrigger className="mt-1 w-full max-w-xl">
                      <SelectValue placeholder="Selecione um e-mail ou uma opção…" />
                    </SelectTrigger>
                    <SelectContent>
                      {emailBusinessEmails.map((em) => (
                        <SelectItem key={em} value={em}>
                          {em}
                        </SelectItem>
                      ))}
                      <SelectItem value={EMAIL_REGISTER_VALUE}>Cadastrar E-mail Business…</SelectItem>
                      <SelectItem value={EMAIL_LATER_VALUE}>Vou cadastrar depois</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><label className="text-sm font-medium text-foreground">CNPJ (opcional)</label><Input value={cnpj} onChange={e => setCnpj(e.target.value)} className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">Cidade sede *</label><Input value={cidadeSede} onChange={e => setCidadeSede(e.target.value)} className="mt-1" /></div>
                <div className="md:col-span-2"><label className="text-sm font-medium text-foreground">Região atendida *</label><Input value={regiaoAtendida} onChange={e => setRegiaoAtendida(e.target.value)} placeholder="Ex: Balneário Camboriú, Itajaí, Navegantes..." className="mt-1" /></div>
              </div>
            </Section>
          )}

          {/* ── STEP 3: Serviços ── */}
          {bs === 3 && (
            <Section title="🚗 Serviços Oferecidos">
              <p className="text-sm text-muted-foreground">Selecione todos os serviços que sua empresa oferece:</p>
              <CheckboxGroup options={SERVICE_TYPES} selected={selectedServices} onChange={setSelectedServices} />
              <div><label className="text-sm font-medium text-foreground">Outro serviço não listado</label><Input value={servicoOutro} onChange={e => setServicoOutro(e.target.value)} placeholder="Descreva aqui..." className="mt-1" /></div>
            </Section>
          )}

          {/* ── STEP 4: Aeroportos ── */}
          {bs === 4 && (
            <Section title="✈️ Aeroportos e Destinos">
              <div>
                <label className="text-sm font-medium text-foreground">Quais aeroportos atende?</label>
                <Textarea value={aeroportos} onChange={e => setAeroportos(e.target.value)} placeholder="Aeroporto de Navegantes&#10;Aeroporto de Florianópolis&#10;Aeroporto de Curitiba" rows={4} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Principais rotas</label>
                <Textarea value={rotas} onChange={e => setRotas(e.target.value)} placeholder="Navegantes → Balneário Camboriú&#10;Florianópolis → Balneário Camboriú&#10;Navegantes → Itapema" rows={4} className="mt-1" />
              </div>
            </Section>
          )}

          {/* ── STEP 5: Frota ── */}
          {bs === 5 && (
            <Section title="🚘 Frota de Veículos">
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Veículos já cadastrados (Motoristas → Cadastros)</label>
                <p className="text-xs text-muted-foreground">
                  Os dados vêm do seu cadastro de motorista/veículo. Marque os que devem aparecer no site ou descreva outros abaixo.
                </p>
                {cadastroVeiculos.length === 0 ? (
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    Nenhum veículo encontrado no seu cadastro.{" "}
                    <button
                      type="button"
                      className="text-primary font-medium underline-offset-2 hover:underline"
                      onClick={() => setActivePage("motoristas/cadastros")}
                    >
                      Abrir Cadastros de motoristas
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {cadastroVeiculos.map((v) => (
                      <label key={v.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background px-3 py-2">
                        <Checkbox
                          checked={veiculosSelecionadosIds.includes(v.id)}
                          onCheckedChange={() => {
                            setVeiculosSelecionadosIds((prev) =>
                              prev.includes(v.id) ? prev.filter((x) => x !== v.id) : [...prev, v.id],
                            );
                          }}
                          className="mt-0.5"
                        />
                        <span className="text-sm text-foreground leading-snug">{v.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Descrição adicional / outros veículos</label>
                <Textarea value={veiculos} onChange={e => setVeiculos(e.target.value)} placeholder="Toyota Corolla 2024 — 4 passageiros, 3 malas&#10;Spin 2023 — 6 passageiros, 5 malas" rows={5} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Use este campo para complementar ou incluir veículos que ainda não estão no cadastro.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Comodidades dos veículos</label>
                <CheckboxGroup options={VEHICLE_AMENITIES} selected={amenidades} onChange={setAmenidades} />
              </div>
            </Section>
          )}

          {/* ── STEP 6: Diferenciais ── */}
          {bs === 6 && (
            <Section title="⭐ Diferenciais do Serviço">
              <CheckboxGroup options={DIFFERENTIALS} selected={diferenciais} onChange={setDiferenciais} />
              <div className="pt-2 border-t border-border">
                <label className="text-sm font-bold text-foreground">🏆 Qual é o principal diferencial da sua empresa?</label>
                <p className="text-xs text-muted-foreground mb-1">Essa pergunta muda completamente o site. Exemplo: "Atendimento VIP para turistas internacionais"</p>
                <Textarea value={diferencialPrincipal} onChange={e => setDiferencialPrincipal(e.target.value)} placeholder="Descreva com suas palavras..." rows={3} className="mt-1" />
              </div>
            </Section>
          )}

          {/* ── STEP 7: Público ── */}
          {bs === 7 && (
            <Section title="🎯 Público-alvo e Posicionamento">
              <p className="text-sm text-muted-foreground">Quem é o público principal?</p>
              <CheckboxGroup options={AUDIENCE_OPTIONS} selected={publicoAlvo} onChange={setPublicoAlvo} />
              <div>
                <label className="text-sm font-medium text-foreground">Faixa de preço / Posicionamento</label>
                <Select value={faixaPreco} onValueChange={setFaixaPreco}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRICE_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </Section>
          )}

          {/* ── STEP 8: Pagamentos ── */}
          {bs === 8 && (
            <Section title="💳 Pagamentos e Reservas">
              <div>
                <label className="text-sm font-medium text-foreground">Formas de pagamento aceitas</label>
                <CheckboxGroup options={PAYMENT_OPTIONS} selected={pagamentos} onChange={setPagamentos} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Como o cliente faz reserva?</label>
                <CheckboxGroup options={BOOKING_OPTIONS} selected={formasReserva} onChange={setFormasReserva} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Horário de atendimento</label>
                <Input value={horarioAtendimento} onChange={e => setHorarioAtendimento(e.target.value)} placeholder="24 horas / Seg-Sex 08h-22h" className="mt-1" />
              </div>
            </Section>
          )}

          {/* ── STEP 9: Redes sociais ── */}
          {bs === 9 && (
            <Section title="📱 Redes Sociais">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-foreground">Instagram</label><Input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@suaempresa" className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">Facebook</label><Input value={facebook} onChange={e => setFacebook(e.target.value)} placeholder="facebook.com/suaempresa" className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">Google Business Profile</label><Input value={googleBusiness} onChange={e => setGoogleBusiness(e.target.value)} placeholder="Link do perfil" className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">TripAdvisor</label><Input value={tripAdvisor} onChange={e => setTripAdvisor(e.target.value)} placeholder="Link do perfil" className="mt-1" /></div>
              </div>
            </Section>
          )}

          {/* ── STEP 10: Idiomas ── */}
          {bs === 10 && (
            <Section title="🌍 Idiomas do Site">
              <CheckboxGroup options={LANGUAGE_OPTIONS} selected={idiomas} onChange={setIdiomas} />
            </Section>
          )}

          {/* ── STEP 11: Páginas ── */}
          {bs === 11 && (
            <Section title="📄 Conteúdo do Site">
              <p className="text-sm text-muted-foreground">Quais páginas deseja incluir?</p>
              <CheckboxGroup options={PAGE_OPTIONS} selected={paginas} onChange={setPaginas} />
              <div>
                <label className="text-sm font-medium text-foreground">Depoimentos de clientes</label>
                <Textarea value={depoimentos} onChange={e => setDepoimentos(e.target.value)} placeholder="Cole aqui depoimentos de clientes satisfeitos..." rows={3} className="mt-1" />
              </div>
            </Section>
          )}

          {/* ── STEP 12: SEO ── */}
          {bs === 12 && (
            <Section title="🔍 SEO Local">
              <p className="text-sm text-muted-foreground">Palavras-chave importantes para o Google encontrar seu site:</p>
              <Textarea value={palavrasChave} onChange={e => setPalavrasChave(e.target.value)} placeholder="transfer aeroporto navegantes&#10;motorista particular balneario camboriu&#10;transfer executivo itajai" rows={5} className="mt-1" />
              <p className="text-xs text-muted-foreground">Coloque uma palavra-chave por linha. Pense como seu cliente pesquisaria no Google.</p>
            </Section>
          )}

          {/* ── STEP 13: Integrações ── */}
          {bs === 13 && (
            <Section title="🔗 Integrações">
              <p className="text-sm text-muted-foreground">O que deseja integrar no site?</p>
              <CheckboxGroup options={INTEGRATION_OPTIONS} selected={integracoes} onChange={setIntegracoes} />
            </Section>
          )}

          {/* ── STEP 14: Conteúdo extra ── */}
          {bs === 14 && (
            <Section title="📦 Conteúdo Extra e Plataformas">
              <div>
                <label className="text-sm font-medium text-foreground">Possui materiais para o site?</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <label className="flex items-center gap-2"><Checkbox checked={temFotosCidade} onCheckedChange={v => setTemFotosCidade(!!v)} /><span className="text-sm text-foreground">Fotos da cidade</span></label>
                  <label className="flex items-center gap-2"><Checkbox checked={temFotosVeiculos} onCheckedChange={v => setTemFotosVeiculos(!!v)} /><span className="text-sm text-foreground">Fotos dos veículos</span></label>
                  <label className="flex items-center gap-2"><Checkbox checked={temFotosMotorista} onCheckedChange={v => setTemFotosMotorista(!!v)} /><span className="text-sm text-foreground">Fotos do motorista</span></label>
                  <label className="flex items-center gap-2"><Checkbox checked={temVideos} onCheckedChange={v => setTemVideos(!!v)} /><span className="text-sm text-foreground">Vídeos</span></label>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <label className="text-sm font-medium text-foreground">Trabalha com plataformas?</label>
                <p className="text-xs text-muted-foreground mb-2">Isso melhora o posicionamento do site.</p>
                <CheckboxGroup options={PLATFORM_OPTIONS} selected={plataformas} onChange={setPlataformas} />
              </div>
            </Section>
          )}

          {/* ── STEP 15: Revisão ── */}
          {bs === 15 && (
            <Section title="✅ Revisão Final">
              <p className="text-sm text-muted-foreground mb-4">Revise as principais informações antes de enviar:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {[
                  ["Modelo", selectedTemplateName],
                  ["Domínio", domain || "—"],
                  ["Empresa", companyName || "—"],
                  ["Responsável", responsavel || "—"],
                  ["WhatsApp", whatsapp || "—"],
                  [
                    "E-mail profissional",
                    professionalEmailChoice === EMAIL_LATER_VALUE
                      ? "Vou cadastrar depois"
                      : professionalEmailChoice || "—",
                  ],
                  ["Cidade sede", cidadeSede || "—"],
                  ["Região", regiaoAtendida || "—"],
                  ["Estilo", desiredStyle],
                  ["Faixa de preço", faixaPreco],
                  ["Idiomas", idiomas.join(", ") || "—"],
                  ["Serviços", selectedServices.length > 0 ? `${selectedServices.length} selecionados` : "—"],
                  ["Páginas", paginas.length > 0 ? `${paginas.length} selecionadas` : "—"],
                  ["Integrações", integracoes.length > 0 ? `${integracoes.length} selecionadas` : "—"],
                ].map(([label, val]) => (
                  <div key={label}><span className="text-muted-foreground">{label}:</span> <span className="text-foreground font-medium">{val}</span></div>
                ))}
              </div>
              {diferencialPrincipal && (
                <div className="mt-3 bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-primary mb-1">⭐ Diferencial Principal</p>
                  <p className="text-sm text-foreground">{diferencialPrincipal}</p>
                </div>
              )}
            </Section>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" onClick={() => {
              if (bs === 1) setStep("domain_pick"); else setBs(s => s - 1);
            }}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <span className="text-xs text-muted-foreground">{bs} de {STEPS.length}</span>
            <Button onClick={() => {
              if (bs === 1) {
                if (!domain.trim()) {
                  toast.error("Volte à etapa anterior e selecione um domínio.");
                  return;
                }
                if (plano === "free") {
                  setUpgradeOpen(true);
                  return;
                }
                if (!logoChoice) {
                  toast.error("Indique se você possui logotipo (SIM ou NÃO).");
                  return;
                }
                if (logoChoice === "sim" && !logoFile) {
                  toast.error("Envie o arquivo da logo. O upload é obrigatório quando você possui logotipo.");
                  return;
                }
              }
              if (bs === 2) {
                if (!companyName.trim()) { toast.error("Preencha o nome da empresa."); return; }
                if (!whatsapp.trim()) { toast.error("Preencha o WhatsApp."); return; }
                if (!professionalEmailChoice) {
                  toast.error("Selecione o e-mail profissional ou uma das opções da lista.");
                  return;
                }
                if (!cidadeSede.trim()) { toast.error("Preencha a cidade sede."); return; }
                if (!regiaoAtendida.trim()) { toast.error("Preencha a região atendida."); return; }
              }
              if (bs === 5) {
                if (veiculosSelecionadosIds.length === 0 && !veiculos.trim()) {
                  toast.error("Selecione ao menos um veículo cadastrado ou descreva a frota no campo de texto.");
                  return;
                }
              }
              if (bs === STEPS.length) { handleSubmitSolicitacao(); return; }
              setBs(s => s + 1);
            }} disabled={submitting}>
              {bs < STEPS.length ? <>Próximo <ArrowRight className="h-4 w-4 ml-2" /></> : (submitting ? "Enviando..." : <>Enviar Briefing <Check className="h-4 w-4 ml-2" /></>)}
            </Button>
          </div>
        </div>
      </>
    );
  }

  // ── Gallery view ───────────────────────────────────
  return (
    <div className="space-y-6">
      <SlideCarousel pagina="website" breakoutTop fallbackSlides={[
        { titulo: "Crie Seu Site Profissional", subtitulo: "Design premium e responsivo para transporte executivo." },
        { titulo: "Templates Exclusivos", subtitulo: "Modelos desenvolvidos para o segmento de transporte." },
      ]} />
      <div>
        <h1 className="text-2xl font-bold text-foreground">Website</h1>
        <p className="text-muted-foreground">Escolha o modelo ideal para o seu site profissional.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {dbTemplates.map(t => {
          const isSelected = selectedTemplate === t.id;
          return (
            <div key={t.id} className="flex flex-col">
              <div
                className={cn(
                  "rounded-xl h-48 relative overflow-hidden border bg-muted group text-left w-full p-0",
                  isSelected ? "ring-2 ring-primary" : "border-border",
                )}
              >
                {t.imagem_url ? (
                  <img src={t.imagem_url} alt={t.nome} className="w-full object-cover object-top transition-transform duration-[120s] ease-linear group-hover:translate-y-[calc(-100%+12rem)]" style={{ minHeight: "200%" }} />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">Sem imagem</div>
                )}
                {isSelected && <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center z-10"><Check className="h-3.5 w-3.5" /></div>}
              </div>
              <p className="font-semibold text-foreground mt-3 text-sm">{t.nome}</p>
              {t.link_modelo && (
                <a href={t.link_modelo} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  <Button variant="outline" size="sm" className="mt-2 w-full gap-2"><Eye className="h-4 w-4" /> Ver Modelo</Button>
                </a>
              )}
              <Button
                type="button"
                size="sm"
                className="mt-2 w-full gap-2"
                variant={isSelected ? "secondary" : "outline"}
                disabled={isSelected}
                onClick={() => selectTemplateOnly(t.id)}
              >
                {isSelected ? (
                  <><Check className="h-4 w-4" /> Modelo selecionado</>
                ) : (
                  "Usar este modelo"
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {selectedTemplate && dbTemplates.length > 0 && (
        <div className="sticky bottom-0 z-10 flex flex-col items-center gap-2 border-t border-border bg-background/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 -mx-4 px-4 sm:-mx-6 sm:px-6">
          <p className="text-center text-sm text-muted-foreground">
            Modelo: <span className="font-medium text-foreground">{selectedTemplateName}</span>
          </p>
          <Button type="button" size="lg" className="w-full max-w-md gap-2" onClick={continueWithSelectedTemplate}>
            Continuar com modelo escolhido
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {dbTemplates.length === 0 && <div className="text-center py-12 text-muted-foreground">Nenhum template disponível no momento.</div>}
      <UpgradePlanDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
