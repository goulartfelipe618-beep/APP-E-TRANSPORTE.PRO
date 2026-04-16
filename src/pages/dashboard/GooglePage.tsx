import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SlideCarousel from "@/components/SlideCarousel";
import FerramentaBetaBloqueioAviso from "@/components/painel/FerramentaBetaBloqueioAviso";
import FerramentaConstrucaoOverlay from "@/components/painel/FerramentaConstrucaoOverlay";
import { usePlataformaFerramentasDisponibilidade } from "@/hooks/usePlataformaFerramentasDisponibilidade";
import {
  Search, Shield, Building2, MapPin, Phone, Clock, Camera,
  Send, ExternalLink, Calendar, Info, CheckCircle2, Star, MessageSquare,
  FileText, Package, Settings, Image, PenLine, Globe, Tag, Users,
  Megaphone, BarChart3, CirclePlus, Plus, Trash2, Edit,
  HelpCircle, Accessibility, Wifi, ParkingCircle, CreditCard, Award,
  ThumbsUp, Reply, Eye, TrendingUp, MousePointerClick, PhoneCall,
  Navigation, Loader2,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserPlan } from "@/hooks/useUserPlan";
import UpgradePlanDialog from "@/components/planos/UpgradePlanDialog";
import GoogleBusinessSolicitationDialog from "@/components/google/GoogleBusinessSolicitationDialog";
import MapboxAddressInput from "@/components/mapbox/MapboxAddressInput";
import ServiceAreaMultiInput from "@/components/google/ServiceAreaMultiInput";
import {
  buildGoogleSolicitacaoPayload,
  formatBrazilPhoneDisplay,
  normalizeBrazilPhoneDigits,
  validateGbpBusinessTitle,
  type GbpDaySchedule,
  type GbpServiceAreaPlace,
  type GbpVerificationAddress,
} from "@/lib/googleBusinessSolicitation";

const DAYS = [
  { name: "Segunda-feira", short: "Seg", defaultOn: true },
  { name: "Terça-feira", short: "Ter", defaultOn: true },
  { name: "Quarta-feira", short: "Qua", defaultOn: true },
  { name: "Quinta-feira", short: "Qui", defaultOn: true },
  { name: "Sexta-feira", short: "Sex", defaultOn: true },
  { name: "Sábado", short: "Sáb", defaultOn: true },
  { name: "Domingo", short: "Dom", defaultOn: false },
];

const MANAGEMENT_TABS = [
  { id: "info", label: "Informações", icon: Building2 },
  { id: "location", label: "Localização", icon: MapPin },
  { id: "contact", label: "Contato", icon: Phone },
  { id: "hours", label: "Horários", icon: Clock },
  { id: "special-hours", label: "Horários Especiais", icon: Calendar },
  { id: "photos", label: "Fotos", icon: Camera },
  { id: "posts", label: "Publicações", icon: FileText },
  { id: "products", label: "Produtos", icon: Package },
  { id: "services", label: "Serviços", icon: Settings },
  { id: "reviews", label: "Críticas", icon: Star },
  { id: "qna", label: "Perguntas", icon: HelpCircle },
  { id: "attributes", label: "Atributos", icon: Tag },
  { id: "performance", label: "Desempenho", icon: BarChart3 },
];

export default function GooglePage() {
  const { hasPlan, plano, refetch: refetchPlano } = useUserPlan();
  const { flags: ferramentasFlags } = usePlataformaFerramentasDisponibilidade();
  const googleConsumoLiberado = ferramentasFlags.google_maps_consumo_liberado;
  const googleFerramentaBloqueada = !googleConsumoLiberado;

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [servicoAtivo, setServicoAtivo] = useState<any>(null);
  const [submittingBriefing, setSubmittingBriefing] = useState(false);

  const [infoBusinessName, setInfoBusinessName] = useState("");
  const [infoPrimaryCategory, setInfoPrimaryCategory] = useState("");
  const [infoSecondaryCategory, setInfoSecondaryCategory] = useState("");
  const [infoDescription, setInfoDescription] = useState("");
  const [infoOpeningYear, setInfoOpeningYear] = useState("");
  const [infoShortName, setInfoShortName] = useState("");

  const [vCep, setVCep] = useState("");
  const [vLogradouro, setVLogradouro] = useState("");
  const [vNumero, setVNumero] = useState("");
  const [vComplemento, setVComplemento] = useState("");
  const [vBairro, setVBairro] = useState("");
  const [vCidade, setVCidade] = useState("");
  const [vUf, setVUf] = useState("");
  const [vMapboxLine, setVMapboxLine] = useState("");
  const [vLat, setVLat] = useState<number | null>(null);
  const [vLng, setVLng] = useState<number | null>(null);
  const [gbpServiceAreas, setGbpServiceAreas] = useState<GbpServiceAreaPlace[]>([]);

  const [phoneDigits, setPhoneDigits] = useState("");
  const [phoneSecDigits, setPhoneSecDigits] = useState("");
  const [whatsDigits, setWhatsDigits] = useState("");
  const [contactWebsite, setContactWebsite] = useState("");
  const [contactBooking, setContactBooking] = useState("");
  const [contactMenu, setContactMenu] = useState("");
  const [socialFb, setSocialFb] = useState("");
  const [socialIg, setSocialIg] = useState("");
  const [socialLi, setSocialLi] = useState("");
  const [socialYt, setSocialYt] = useState("");

  const [locEndereco, setLocEndereco] = useState("");
  const [locBairro, setLocBairro] = useState("");
  const [locCep, setLocCep] = useState("");
  const [locCidade, setLocCidade] = useState("");
  const [locEstado, setLocEstado] = useState("");
  const [locPais, setLocPais] = useState("Brasil");
  const [locLat, setLocLat] = useState("");
  const [locLng, setLocLng] = useState("");
  const [locAreaTexto, setLocAreaTexto] = useState("");

  /** Estado compartilhado com a UI de “gestão” (mock); wizard de criação usa componente próprio. */
  const [serviceArea, setServiceArea] = useState(true);
  const [schedule, setSchedule] = useState(
    DAYS.map((d) => ({ ...d, open: "08:00", close: "18:00", enabled: d.defaultOn }))
  );

  // === Management state ===
  const [posts, setPosts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [specialHours, setSpecialHours] = useState<any[]>([]);

  // New post form
  const [newPostType, setNewPostType] = useState("update");
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostCta, setNewPostCta] = useState("");
  const [newPostImageUrl, setNewPostImageUrl] = useState("");

  // New product form
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductDesc, setNewProductDesc] = useState("");
  const [newProductImageUrl, setNewProductImageUrl] = useState("");

  // New service form
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceDesc, setNewServiceDesc] = useState("");

  // Special hours form
  const [specialDate, setSpecialDate] = useState("");
  const [specialOpen, setSpecialOpen] = useState("");
  const [specialClose, setSpecialClose] = useState("");
  const [specialClosed, setSpecialClosed] = useState(false);

  // Attributes
  const [attributes, setAttributes] = useState({
    wheelchair: false,
    wifi: false,
    parking: false,
    creditCard: true,
    appointment: true,
    onlineBooking: true,
    lgbtFriendly: false,
    petFriendly: false,
  });

  const refreshServicoGoogle = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await (supabase.from("solicitacoes_servicos" as any).select("*").eq("user_id", user.id).eq("tipo_servico", "google").order("created_at", { ascending: false }).limit(1) as any);
    if (data && data.length > 0) setServicoAtivo(data[0]);
    else setServicoAtivo(null);
  };

  useEffect(() => {
    void refreshServicoGoogle();
  }, []);

  useEffect(() => {
    if (!googleConsumoLiberado) setCreateOpen(false);
  }, [googleConsumoLiberado]);

  const hasProfile = !!servicoAtivo;
  const bloqueadoEnvio =
    !!servicoAtivo &&
    ["pendente", "em_andamento", "pendente_verificacao"].includes(String(servicoAtivo.status));
  const podeEnviarNovoBriefing = !servicoAtivo || servicoAtivo.status === "recusado";

  const hydratedIdRef = useRef<string | null>(null);

  const aplicarDadosBriefing = useCallback((d: Record<string, unknown>) => {
    if (typeof d.business_title === "string") setInfoBusinessName(d.business_title);
    const info = (d.informacoes_perfil || d.informacoes_negocio) as Record<string, unknown> | undefined;
    if (info && typeof info === "object") {
      if (typeof info.categoria_principal === "string") setInfoPrimaryCategory(info.categoria_principal);
      if (typeof info.categoria_secundaria === "string") setInfoSecondaryCategory(info.categoria_secundaria);
      if (typeof info.descricao === "string") setInfoDescription(info.descricao);
      if (typeof info.ano_abertura === "string" || typeof info.ano_abertura === "number") {
        setInfoOpeningYear(String(info.ano_abertura));
      }
      if (typeof info.identificador_curto === "string") setInfoShortName(info.identificador_curto);
    }
    const ver = d.verification_address as Record<string, unknown> | undefined;
    if (ver && typeof ver === "object") {
      setVCep(String(ver.cep ?? ""));
      setVLogradouro(String(ver.logradouro ?? ""));
      setVNumero(String(ver.numero ?? ""));
      setVComplemento(String(ver.complemento ?? ""));
      setVBairro(String(ver.bairro ?? ""));
      setVCidade(String(ver.cidade ?? ""));
      setVUf(String(ver.uf ?? ""));
      setVMapboxLine(typeof ver.linha_completa === "string" ? ver.linha_completa : "");
      setVLat(typeof ver.latitude === "number" ? ver.latitude : null);
      setVLng(typeof ver.longitude === "number" ? ver.longitude : null);
    }
    if (Array.isArray(d.service_areas)) setGbpServiceAreas(d.service_areas as GbpServiceAreaPlace[]);
    if (typeof d.primary_phone === "string") setPhoneDigits(d.primary_phone);
    const c = d.contato_exibicao as Record<string, unknown> | undefined;
    if (c && typeof c === "object") {
      if (typeof c.telefone_secundario === "string") {
        setPhoneSecDigits(normalizeBrazilPhoneDigits(c.telefone_secundario));
      }
      if (typeof c.whatsapp === "string") setWhatsDigits(normalizeBrazilPhoneDigits(c.whatsapp));
      if (typeof c.website === "string") setContactWebsite(c.website);
      if (typeof c.link_agendamento === "string") setContactBooking(c.link_agendamento);
      if (typeof c.link_menu === "string") setContactMenu(c.link_menu);
      if (typeof c.facebook === "string") setSocialFb(c.facebook);
      if (typeof c.instagram === "string") setSocialIg(c.instagram);
      if (typeof c.linkedin === "string") setSocialLi(c.linkedin);
      if (typeof c.youtube === "string") setSocialYt(c.youtube);
    }
    const loc = d.localizacao_opcional_maps as Record<string, unknown> | undefined;
    if (loc && typeof loc === "object") {
      if (typeof loc.endereco === "string") setLocEndereco(loc.endereco);
      if (typeof loc.bairro === "string") setLocBairro(loc.bairro);
      if (typeof loc.cep === "string") setLocCep(loc.cep);
      if (typeof loc.cidade === "string") setLocCidade(loc.cidade);
      if (typeof loc.estado === "string") setLocEstado(loc.estado);
      if (typeof loc.pais === "string") setLocPais(loc.pais);
      if (loc.latitude != null) setLocLat(String(loc.latitude));
      if (loc.longitude != null) setLocLng(String(loc.longitude));
      if (typeof loc.areas_texto_livre === "string") setLocAreaTexto(loc.areas_texto_livre);
    }
    if (Array.isArray(d.regular_hours)) {
      setSchedule(
        DAYS.map((day, i) => {
          const found = (d.regular_hours as { dayIndex?: number; enabled?: boolean; open?: string; close?: string }[]).find(
            (h) => h.dayIndex === i,
          );
          return {
            ...day,
            enabled: found ? !!found.enabled : day.defaultOn,
            open: found?.open || "08:00",
            close: found?.close || "18:00",
          };
        }),
      );
    }
    if (Array.isArray(d.horarios_especiais)) setSpecialHours(d.horarios_especiais as any[]);
    if (Array.isArray(d.publicacoes_rascunho)) setPosts(d.publicacoes_rascunho as any[]);
    if (Array.isArray(d.produtos_rascunho)) setProducts(d.produtos_rascunho as any[]);
    if (Array.isArray(d.servicos_rascunho)) setServices(d.servicos_rascunho as any[]);
    if (d.atributos && typeof d.atributos === "object" && !Array.isArray(d.atributos)) {
      setAttributes((prev) => ({ ...prev, ...(d.atributos as typeof attributes) }));
    }
  }, []);

  useEffect(() => {
    if (!servicoAtivo?.id || !servicoAtivo?.dados_solicitacao) return;
    if (hydratedIdRef.current === servicoAtivo.id) return;
    hydratedIdRef.current = servicoAtivo.id;
    aplicarDadosBriefing(servicoAtivo.dados_solicitacao as Record<string, unknown>);
  }, [servicoAtivo, aplicarDadosBriefing]);

  const verificationAddress = (): GbpVerificationAddress => ({
    cep: vCep.trim(),
    logradouro: vLogradouro.trim(),
    numero: vNumero.trim(),
    complemento: vComplemento.trim(),
    bairro: vBairro.trim(),
    cidade: vCidade.trim(),
    uf: vUf.trim().toUpperCase().slice(0, 2),
    linha_completa: vMapboxLine.trim() || undefined,
    latitude: vLat,
    longitude: vLng,
  });

  const handleEnviarBriefingCompleto = async () => {
    if (!googleConsumoLiberado) {
      toast.error("Esta ferramenta ainda não está disponível para uso. Aguarde a liberação da plataforma.");
      return;
    }
    if (!hasPlan("pro")) {
      setUpgradeOpen(true);
      return;
    }
    if (bloqueadoEnvio) {
      toast.error("Já existe uma solicitação em análise. Aguarde o retorno da equipe.");
      return;
    }
    if (!podeEnviarNovoBriefing) {
      toast.error("Não é possível enviar um novo briefing neste status.");
      return;
    }
    const titleCheck = validateGbpBusinessTitle(infoBusinessName);
    if (!titleCheck.ok) {
      toast.error(titleCheck.message);
      return;
    }
    if (!infoPrimaryCategory) {
      toast.error("Selecione a categoria principal do negócio.");
      setActiveTab("info");
      return;
    }
    if (infoDescription.trim().length < 20) {
      toast.error("Preencha a descrição do negócio (mínimo 20 caracteres).");
      setActiveTab("info");
      return;
    }
    const va = verificationAddress();
    if (!va.cep || !va.logradouro || !va.numero || !va.bairro || !va.cidade || !va.uf || va.uf.length < 2) {
      toast.error("Na aba Localização, preencha o endereço de verificação (CEP, rua, número, bairro, cidade e UF).");
      setActiveTab("location");
      return;
    }
    if (gbpServiceAreas.length < 1) {
      toast.error("Adicione pelo menos uma cidade ou região em Áreas de atendimento.");
      setActiveTab("location");
      return;
    }
    const digits = normalizeBrazilPhoneDigits(phoneDigits);
    if (digits.length < 10) {
      toast.error("Informe o telefone principal (WhatsApp / contato) na aba Contato.");
      setActiveTab("contact");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }

    setSubmittingBriefing(true);
    try {
      const { data: free, error: rpcErr } = await supabase.rpc(
        "motorista_telefone_disponivel_para_google" as any,
        { p_user_id: user.id, p_telefone: digits } as any,
      );
      if (rpcErr) {
        toast.error("Não foi possível validar o telefone. Tente novamente.");
        return;
      }
      if (free !== true) {
        toast.error("Este número já está em uso por outro cadastro. Use um telefone exclusivo para o Google.");
        return;
      }

      const regular_hours: GbpDaySchedule[] = schedule.map((day, i) => ({
        dayIndex: i,
        dayShort: day.short,
        dayName: day.name,
        enabled: day.enabled,
        open: day.open,
        close: day.close,
      }));

      const core = buildGoogleSolicitacaoPayload({
        userId: user.id,
        businessTitle: infoBusinessName.trim(),
        verificationAddress: va,
        serviceAreas: gbpServiceAreas,
        primaryPhoneDigits: digits,
        regularHours: regular_hours,
      });

      const contato_exibicao: Record<string, string> = {};
      const sec = normalizeBrazilPhoneDigits(phoneSecDigits);
      if (sec.length >= 10) contato_exibicao.telefone_secundario = formatBrazilPhoneDisplay(sec);
      const w = normalizeBrazilPhoneDigits(whatsDigits);
      if (w.length >= 10) contato_exibicao.whatsapp = formatBrazilPhoneDisplay(w);
      if (contactWebsite.trim()) contato_exibicao.website = contactWebsite.trim();
      if (contactBooking.trim()) contato_exibicao.link_agendamento = contactBooking.trim();
      if (contactMenu.trim()) contato_exibicao.link_menu = contactMenu.trim();
      if (socialFb.trim()) contato_exibicao.facebook = socialFb.trim();
      if (socialIg.trim()) contato_exibicao.instagram = socialIg.trim();
      if (socialLi.trim()) contato_exibicao.linkedin = socialLi.trim();
      if (socialYt.trim()) contato_exibicao.youtube = socialYt.trim();

      const localizacao_opcional_maps: Record<string, string> = {};
      if (locEndereco.trim()) localizacao_opcional_maps.endereco = locEndereco.trim();
      if (locBairro.trim()) localizacao_opcional_maps.bairro = locBairro.trim();
      if (locCep.trim()) localizacao_opcional_maps.cep = locCep.trim();
      if (locCidade.trim()) localizacao_opcional_maps.cidade = locCidade.trim();
      if (locEstado.trim()) localizacao_opcional_maps.estado = locEstado.trim();
      if (locPais.trim()) localizacao_opcional_maps.pais = locPais.trim();
      if (locLat.trim()) localizacao_opcional_maps.latitude = locLat.trim();
      if (locLng.trim()) localizacao_opcional_maps.longitude = locLng.trim();
      if (locAreaTexto.trim()) localizacao_opcional_maps.areas_texto_livre = locAreaTexto.trim();

      const dados_solicitacao: Record<string, unknown> = {
        ...core,
        informacoes_perfil: {
          categoria_principal: infoPrimaryCategory,
          categoria_secundaria: infoSecondaryCategory || undefined,
          descricao: infoDescription.trim(),
          ano_abertura: infoOpeningYear.trim() || undefined,
          identificador_curto: infoShortName.trim() || undefined,
        },
        contato_exibicao: Object.keys(contato_exibicao).length ? contato_exibicao : undefined,
        localizacao_opcional_maps: Object.keys(localizacao_opcional_maps).length ? localizacao_opcional_maps : undefined,
        horarios_especiais: specialHours.length ? specialHours : undefined,
        publicacoes_rascunho: posts.length ? posts : undefined,
        produtos_rascunho: products.length ? products : undefined,
        servicos_rascunho: services.length ? services : undefined,
        atributos: attributes,
      };

      const { error } = await supabase.from("solicitacoes_servicos" as any).insert({
        user_id: user.id,
        tipo_servico: "google",
        dados_solicitacao: dados_solicitacao,
      } as any);

      if (error) {
        toast.error("Erro ao enviar: " + error.message);
        return;
      }
      toast.success("Briefing enviado para análise da equipe.");
      hydratedIdRef.current = null;
      await refreshServicoGoogle();
    } finally {
      setSubmittingBriefing(false);
    }
  };

  const pendingBanner =
    servicoAtivo &&
    (servicoAtivo.status === "pendente" ||
      servicoAtivo.status === "em_andamento" ||
      servicoAtivo.status === "pendente_verificacao") ? (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-start gap-3">
      <Info className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          {servicoAtivo.status === "pendente_verificacao"
            ? "Perfil aguardando verificação no Google"
            : "Solicitação Google Business em análise"}
        </p>
        <p className="text-xs text-muted-foreground">
          Status:{" "}
          <Badge variant="outline">
            {servicoAtivo.status === "pendente"
              ? "Pendente"
              : servicoAtivo.status === "em_andamento"
                ? "Em andamento"
                : "Pendente de verificação (Google)"}
          </Badge>
        </p>
        {servicoAtivo.status === "pendente_verificacao" && (
          <p className="text-xs text-muted-foreground pt-1">
            O Google pode pedir <strong className="text-foreground">verificação por vídeo</strong> no aplicativo Google Business Profile
            (mostrar veículo, painel ou documentos). Abra o app e siga as etapas indicadas pelo Google.
          </p>
        )}
      </div>
    </div>
  ) : null;

  const activeBanner = servicoAtivo?.status === "concluido" ? (
    <div className="rounded-xl border border-primary/30 bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Perfil Google Business — Ativo</h2>
      </div>
      {servicoAtivo.link_acesso && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Link de Acesso</p>
          <a href={servicoAtivo.link_acesso} target="_blank" rel="noopener noreferrer" className="text-primary font-medium flex items-center gap-1 hover:underline">
            <ExternalLink className="h-4 w-4" /> {servicoAtivo.link_acesso}
          </a>
        </div>
      )}
      {servicoAtivo.data_expiracao && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Válido até</p>
          <p className="text-foreground font-medium flex items-center gap-1"><Calendar className="h-4 w-4" /> {new Date(servicoAtivo.data_expiracao).toLocaleDateString("pt-BR")}</p>
        </div>
      )}
      {servicoAtivo.instrucoes_acesso && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Instruções</p>
          <p className="text-foreground whitespace-pre-wrap">{servicoAtivo.instrucoes_acesso}</p>
        </div>
      )}
      {servicoAtivo.como_usar && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Como Usar</p>
          <p className="text-foreground whitespace-pre-wrap">{servicoAtivo.como_usar}</p>
        </div>
      )}
    </div>
  ) : null;

  // === INLINE MANAGEMENT SECTION ===
  function renderManagementInline() {
    return (
      <div className="flex rounded-xl border border-border overflow-hidden bg-card" style={{ minHeight: "600px" }}>
        {/* Sidebar */}
        <div className="w-56 border-r border-border bg-muted/30 p-3 space-y-1 overflow-y-auto shrink-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">Gerenciar</p>
              {MANAGEMENT_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* INFO */}
              {activeTab === "info" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Informações do Negócio</h3>
                    <p className="text-sm text-muted-foreground">Edite as informações básicas do seu perfil no Google.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Nome do Negócio *</Label>
                      <Input
                        value={infoBusinessName}
                        onChange={(e) => setInfoBusinessName(e.target.value)}
                        placeholder="Ex: João Silva Transportes (sem cidade, preço ou promoção)"
                        maxLength={58}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Conforme regras do Google — nome ou razão social, até 58 caracteres.</p>
                    </div>
                    <div>
                      <Label>Categoria Principal *</Label>
                      <Select value={infoPrimaryCategory || undefined} onValueChange={setInfoPrimaryCategory}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="transporte_executivo">Serviço de Transporte Executivo</SelectItem>
                          <SelectItem value="taxi">Serviço de Táxi</SelectItem>
                          <SelectItem value="aluguel_veiculos">Aluguel de Veículos</SelectItem>
                          <SelectItem value="limusine">Serviço de Limusine</SelectItem>
                          <SelectItem value="transporte_aeroporto">Transporte para Aeroporto</SelectItem>
                          <SelectItem value="shuttle">Serviço de Shuttle</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Categoria Secundária</Label>
                      <Select value={infoSecondaryCategory || undefined} onValueChange={setInfoSecondaryCategory}>
                        <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="transporte">Serviço de Transporte</SelectItem>
                          <SelectItem value="turismo">Turismo</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label>Descrição do Negócio</Label>
                      <Textarea
                        value={infoDescription}
                        onChange={(e) => setInfoDescription(e.target.value)}
                        placeholder="Descreva seus serviços em detalhes..."
                        maxLength={750}
                        className="min-h-[120px]"
                      />
                      <p className="text-xs text-muted-foreground mt-1">{infoDescription.length}/750 caracteres (mínimo 20 para enviar)</p>
                    </div>
                    <div>
                      <Label>Ano de Abertura</Label>
                      <Input type="number" placeholder="2020" value={infoOpeningYear} onChange={(e) => setInfoOpeningYear(e.target.value)} />
                    </div>
                    <div>
                      <Label>Identificador Curto (short name)</Label>
                      <Input value={infoShortName} onChange={(e) => setInfoShortName(e.target.value)} placeholder="minha-empresa" />
                    </div>
                  </div>
                </div>
              )}

              {/* LOCATION */}
              {activeTab === "location" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Localização e Área de Atendimento</h3>
                    <p className="text-sm text-muted-foreground">Defina onde sua empresa está e as regiões que atende.</p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Service Area Business (SAB)</p>
                      <p className="text-xs text-muted-foreground">Ative se o serviço é móvel, sem ponto físico fixo. Recomendado para motoristas.</p>
                    </div>
                    <Switch checked={serviceArea} onCheckedChange={setServiceArea} />
                  </div>
                  {serviceArea && (
                    <div>
                      <Label>Áreas de Atendimento *</Label>
                      <Textarea placeholder="São Paulo, Guarulhos, ABC Paulista, Campinas..." className="min-h-[80px]" />
                      <p className="text-xs text-muted-foreground mt-1">Separe as cidades/regiões por vírgula</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Endereço</Label><Input placeholder="Av. Paulista, 1000" /></div>
                    <div><Label>Bairro</Label><Input placeholder="Bela Vista" /></div>
                    <div><Label>CEP</Label><Input placeholder="00000-000" /></div>
                    <div><Label>Cidade</Label><Input placeholder="São Paulo" /></div>
                    <div><Label>Estado</Label><Input placeholder="SP" /></div>
                    <div><Label>País</Label><Input placeholder="Brasil" defaultValue="Brasil" /></div>
                  </div>
                  <div>
                    <Label>Coordenadas (Latitude, Longitude)</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <Input placeholder="-23.5505" />
                      <Input placeholder="-46.6333" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Opcional. Ajuda a posicionar seu pin no Maps com precisão.</p>
                  </div>
                  <Button className="bg-primary text-primary-foreground"><Send className="h-4 w-4 mr-2" /> Salvar Localização</Button>
                </div>
              )}

              {/* CONTACT */}
              {activeTab === "contact" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Informações de Contato</h3>
                    <p className="text-sm text-muted-foreground">Telefone, website e links de contato.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Telefone Principal *</Label><Input placeholder="(11) 99999-9999" /></div>
                    <div><Label>Telefone Secundário</Label><Input placeholder="(11) 3333-3333" /></div>
                    <div><Label>WhatsApp</Label><Input placeholder="(11) 99999-9999" /></div>
                    <div><Label>Website</Label><Input placeholder="https://www.exemplo.com.br" /></div>
                    <div><Label>Link de Agendamento</Label><Input placeholder="https://booking.exemplo.com" /></div>
                    <div><Label>Link do Menu/Cardápio</Label><Input placeholder="https://..." /></div>
                  </div>
                  <div>
                    <Label>Links de Redes Sociais</Label>
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-24">Facebook</span>
                        <Input placeholder="https://facebook.com/..." className="flex-1" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-24">Instagram</span>
                        <Input placeholder="https://instagram.com/..." className="flex-1" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-24">LinkedIn</span>
                        <Input placeholder="https://linkedin.com/..." className="flex-1" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-24">YouTube</span>
                        <Input placeholder="https://youtube.com/..." className="flex-1" />
                      </div>
                    </div>
                  </div>
                  <Button className="bg-primary text-primary-foreground"><Send className="h-4 w-4 mr-2" /> Salvar Contato</Button>
                </div>
              )}

              {/* HOURS */}
              {activeTab === "hours" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Horário de Funcionamento</h3>
                    <p className="text-sm text-muted-foreground">Defina os horários regulares do seu negócio.</p>
                  </div>
                  <div className="space-y-3">
                    {schedule.map((day, i) => (
                      <div key={day.name} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                        <Switch
                          checked={day.enabled}
                          onCheckedChange={(v) => setSchedule((s) => { const n = [...s]; n[i] = { ...n[i], enabled: v }; return n; })}
                        />
                        <span className="text-sm text-foreground w-32 font-medium">{day.name}</span>
                        {day.enabled ? (
                          <div className="flex items-center gap-2">
                            <Input type="time" value={day.open} className="w-32" onChange={(e) => setSchedule((s) => { const n = [...s]; n[i] = { ...n[i], open: e.target.value }; return n; })} />
                            <span className="text-xs text-muted-foreground">às</span>
                            <Input type="time" value={day.close} className="w-32" onChange={(e) => setSchedule((s) => { const n = [...s]; n[i] = { ...n[i], close: e.target.value }; return n; })} />
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-destructive border-destructive/30">Fechado</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                    <Info className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-xs text-muted-foreground">Para serviços 24h, defina abertura 00:00 e fechamento 23:59.</p>
                  </div>
                  <Button className="bg-primary text-primary-foreground"><Send className="h-4 w-4 mr-2" /> Salvar Horários</Button>
                </div>
              )}

              {/* SPECIAL HOURS */}
              {activeTab === "special-hours" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Horários Especiais / Feriados</h3>
                    <p className="text-sm text-muted-foreground">Configure horários diferentes para datas específicas.</p>
                  </div>
                  <Card className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Data</Label><Input type="date" value={specialDate} onChange={(e) => setSpecialDate(e.target.value)} /></div>
                      <div className="flex items-center gap-2 pt-6">
                        <Switch checked={specialClosed} onCheckedChange={setSpecialClosed} />
                        <span className="text-sm text-foreground">Fechado neste dia</span>
                      </div>
                    </div>
                    {!specialClosed && (
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Abertura</Label><Input type="time" value={specialOpen} onChange={(e) => setSpecialOpen(e.target.value)} /></div>
                        <div><Label>Fechamento</Label><Input type="time" value={specialClose} onChange={(e) => setSpecialClose(e.target.value)} /></div>
                      </div>
                    )}
                    <Button variant="outline" size="sm" onClick={() => {
                      if (!specialDate) { toast.error("Selecione uma data."); return; }
                      setSpecialHours([...specialHours, { date: specialDate, closed: specialClosed, open: specialOpen, close: specialClose }]);
                      setSpecialDate(""); setSpecialOpen(""); setSpecialClose(""); setSpecialClosed(false);
                      toast.success("Horário especial adicionado.");
                    }}>
                      <CirclePlus className="h-4 w-4 mr-2" /> Adicionar
                    </Button>
                  </Card>

                  {specialHours.length > 0 && (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Horário</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {specialHours.map((sh, i) => (
                            <TableRow key={i}>
                              <TableCell>{new Date(sh.date + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                              <TableCell>
                                <Badge variant={sh.closed ? "destructive" : "outline"}>
                                  {sh.closed ? "Fechado" : "Aberto"}
                                </Badge>
                              </TableCell>
                              <TableCell>{sh.closed ? "—" : `${sh.open} - ${sh.close}`}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => setSpecialHours(specialHours.filter((_, j) => j !== i))}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  <Button className="bg-primary text-primary-foreground"><Send className="h-4 w-4 mr-2" /> Salvar Horários Especiais</Button>
                </div>
              )}

              {/* PHOTOS */}
              {activeTab === "photos" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Fotos do Perfil</h3>
                    <p className="text-sm text-muted-foreground">Gerencie todas as fotos do seu perfil no Google.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Image className="h-5 w-5 text-primary" />
                        <h4 className="text-sm font-semibold text-foreground">Logotipo</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">Imagem quadrada, mínimo 250x250px</p>
                      <Input placeholder="URL da imagem..." />
                      <Button variant="outline" size="sm"><Camera className="h-4 w-4 mr-2" /> Enviar Foto</Button>
                    </Card>
                    <Card className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Image className="h-5 w-5 text-primary" />
                        <h4 className="text-sm font-semibold text-foreground">Foto de Capa</h4>
                      </div>
                      <p className="text-xs text-muted-foreground">Proporção 16:9, mínimo 480x270px</p>
                      <Input placeholder="URL da imagem..." />
                      <Button variant="outline" size="sm"><Camera className="h-4 w-4 mr-2" /> Enviar Foto</Button>
                    </Card>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Categorias de Fotos</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {["Exterior", "Interior", "Equipe", "Veículos", "No Trabalho", "Alimentos e Bebidas"].map((cat) => (
                        <Card key={cat} className="p-4 text-center space-y-2 cursor-pointer hover:border-primary/50 transition-colors">
                          <Camera className="h-8 w-8 text-muted-foreground mx-auto" />
                          <p className="text-xs font-medium text-foreground">{cat}</p>
                          <p className="text-xs text-muted-foreground">0 fotos</p>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <Card className="p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">Adicionar Fotos</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Categoria</Label>
                        <Select><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="exterior">Exterior</SelectItem>
                            <SelectItem value="interior">Interior</SelectItem>
                            <SelectItem value="equipe">Equipe</SelectItem>
                            <SelectItem value="veiculos">Veículos</SelectItem>
                            <SelectItem value="trabalho">No Trabalho</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>URL da Foto</Label><Input placeholder="https://..." /></div>
                    </div>
                    <Button variant="outline" size="sm"><CirclePlus className="h-4 w-4 mr-2" /> Adicionar Foto</Button>
                  </Card>
                </div>
              )}

              {/* POSTS */}
              {activeTab === "posts" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Publicações</h3>
                    <p className="text-sm text-muted-foreground">Crie publicações, ofertas e eventos para seu perfil.</p>
                  </div>

                  <Card className="p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-foreground">Nova Publicação</h4>
                    <div>
                      <Label>Tipo de Publicação</Label>
                      <Select value={newPostType} onValueChange={setNewPostType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="update">Atualização</SelectItem>
                          <SelectItem value="offer">Oferta</SelectItem>
                          <SelectItem value="event">Evento</SelectItem>
                          <SelectItem value="product">Produto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newPostType === "event" && (
                      <div><Label>Título do Evento</Label><Input value={newPostTitle} onChange={(e) => setNewPostTitle(e.target.value)} placeholder="Ex: Promoção de Fim de Ano" /></div>
                    )}
                    {newPostType === "offer" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Título da Oferta</Label><Input value={newPostTitle} onChange={(e) => setNewPostTitle(e.target.value)} placeholder="Ex: 20% de desconto" /></div>
                        <div><Label>Código do Cupom</Label><Input placeholder="PROMO20" /></div>
                        <div><Label>Data Início</Label><Input type="date" /></div>
                        <div><Label>Data Fim</Label><Input type="date" /></div>
                      </div>
                    )}
                    <div><Label>Conteúdo *</Label><Textarea value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} placeholder="Escreva sua publicação..." className="min-h-[100px]" maxLength={1500} /></div>
                    <div><Label>URL da Imagem</Label><Input value={newPostImageUrl} onChange={(e) => setNewPostImageUrl(e.target.value)} placeholder="https://..." /></div>
                    <div>
                      <Label>Botão de Ação (CTA)</Label>
                      <Select value={newPostCta} onValueChange={setNewPostCta}>
                        <SelectTrigger><SelectValue placeholder="Sem botão" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem botão</SelectItem>
                          <SelectItem value="book">Reservar</SelectItem>
                          <SelectItem value="order">Pedir</SelectItem>
                          <SelectItem value="learn_more">Saiba mais</SelectItem>
                          <SelectItem value="sign_up">Registrar</SelectItem>
                          <SelectItem value="call">Ligar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={() => {
                      if (!newPostContent.trim()) { toast.error("Escreva o conteúdo da publicação."); return; }
                      setPosts([...posts, { type: newPostType, title: newPostTitle, content: newPostContent, cta: newPostCta, image: newPostImageUrl, date: new Date().toISOString() }]);
                      setNewPostContent(""); setNewPostTitle(""); setNewPostImageUrl(""); setNewPostCta("");
                      toast.success("Publicação criada!");
                    }}>
                      <Megaphone className="h-4 w-4 mr-2" /> Publicar
                    </Button>
                  </Card>

                  {posts.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">Publicações Recentes</h4>
                      {posts.map((post, i) => (
                        <Card key={i} className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <Badge variant="outline" className="mb-2">{post.type === "update" ? "Atualização" : post.type === "offer" ? "Oferta" : post.type === "event" ? "Evento" : "Produto"}</Badge>
                              {post.title && <p className="text-sm font-medium text-foreground">{post.title}</p>}
                              <p className="text-sm text-muted-foreground mt-1">{post.content}</p>
                              <p className="text-xs text-muted-foreground mt-2">{new Date(post.date).toLocaleDateString("pt-BR")}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setPosts(posts.filter((_, j) => j !== i))}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PRODUCTS */}
              {activeTab === "products" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Produtos</h3>
                    <p className="text-sm text-muted-foreground">Adicione produtos/serviços com preços ao seu perfil.</p>
                  </div>

                  <Card className="p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-foreground">Novo Produto</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Nome do Produto *</Label><Input value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="Ex: Transfer Aeroporto" /></div>
                      <div><Label>Preço (R$)</Label><Input value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)} placeholder="220,00" /></div>
                    </div>
                    <div><Label>Descrição</Label><Textarea value={newProductDesc} onChange={(e) => setNewProductDesc(e.target.value)} placeholder="Descreva o produto..." /></div>
                    <div><Label>URL da Imagem</Label><Input value={newProductImageUrl} onChange={(e) => setNewProductImageUrl(e.target.value)} placeholder="https://..." /></div>
                    <div>
                      <Label>Categoria do Produto</Label>
                      <Select><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="transfer">Transfer</SelectItem>
                          <SelectItem value="passeio">Passeio</SelectItem>
                          <SelectItem value="eventos">Eventos</SelectItem>
                          <SelectItem value="diaria">Diária</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" onClick={() => {
                      if (!newProductName.trim()) { toast.error("Informe o nome do produto."); return; }
                      setProducts([...products, { name: newProductName, price: newProductPrice, desc: newProductDesc, image: newProductImageUrl }]);
                      setNewProductName(""); setNewProductPrice(""); setNewProductDesc(""); setNewProductImageUrl("");
                      toast.success("Produto adicionado!");
                    }}>
                      <CirclePlus className="h-4 w-4 mr-2" /> Adicionar Produto
                    </Button>
                  </Card>

                  {products.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {products.map((p, i) => (
                        <Card key={i} className="p-4 space-y-2">
                          <p className="text-sm font-medium text-foreground">{p.name}</p>
                          {p.price && <p className="text-primary font-semibold">R$ {p.price}</p>}
                          {p.desc && <p className="text-xs text-muted-foreground">{p.desc}</p>}
                          <Button variant="ghost" size="sm" onClick={() => setProducts(products.filter((_, j) => j !== i))}>
                            <Trash2 className="h-3 w-3 text-destructive mr-1" /> Remover
                          </Button>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SERVICES */}
              {activeTab === "services" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Serviços</h3>
                    <p className="text-sm text-muted-foreground">Liste os serviços oferecidos pelo seu negócio.</p>
                  </div>

                  <Card className="p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-foreground">Novo Serviço</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Nome do Serviço *</Label><Input value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} placeholder="Ex: Transfer Executivo" /></div>
                      <div><Label>Preço (R$)</Label><Input value={newServicePrice} onChange={(e) => setNewServicePrice(e.target.value)} placeholder="150,00" /></div>
                    </div>
                    <div><Label>Descrição</Label><Textarea value={newServiceDesc} onChange={(e) => setNewServiceDesc(e.target.value)} placeholder="Descreva o serviço..." /></div>
                    <Button variant="outline" onClick={() => {
                      if (!newServiceName.trim()) { toast.error("Informe o nome do serviço."); return; }
                      setServices([...services, { name: newServiceName, price: newServicePrice, desc: newServiceDesc }]);
                      setNewServiceName(""); setNewServicePrice(""); setNewServiceDesc("");
                      toast.success("Serviço adicionado!");
                    }}>
                      <CirclePlus className="h-4 w-4 mr-2" /> Adicionar Serviço
                    </Button>
                  </Card>

                  {services.length > 0 && (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Serviço</TableHead>
                            <TableHead>Preço</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {services.map((s, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              <TableCell>{s.price ? `R$ ${s.price}` : "—"}</TableCell>
                              <TableCell className="text-muted-foreground max-w-[200px] truncate">{s.desc || "—"}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => setServices(services.filter((_, j) => j !== i))}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {/* REVIEWS */}
              {activeTab === "reviews" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Críticas e Avaliações</h3>
                    <p className="text-sm text-muted-foreground">Veja e responda às avaliações dos clientes.</p>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <Card className="p-4 text-center">
                      <Star className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-foreground">5.0</p>
                      <p className="text-xs text-muted-foreground">Nota Média</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <MessageSquare className="h-6 w-6 text-primary mx-auto mb-1" />
                      <p className="text-2xl font-bold text-foreground">52</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <Reply className="h-6 w-6 text-green-500 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-foreground">48</p>
                      <p className="text-xs text-muted-foreground">Respondidas</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <Clock className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-foreground">4</p>
                      <p className="text-xs text-muted-foreground">Pendentes</p>
                    </Card>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button variant="outline"><Globe className="h-4 w-4 mr-2" /> Solicitar Avaliações</Button>
                    <Button variant="outline"><ExternalLink className="h-4 w-4 mr-2" /> Link de Avaliação</Button>
                  </div>

                  <div className="space-y-3">
                    {[
                      { name: "Ana M.", rating: 5, text: "Fiz tudo pelo site, de forma rápida e prática.", date: "2025-03-10", replied: true },
                      { name: "Carlos R.", rating: 5, text: "Ótimo atendimento, serviço exclusivo de luxo em Balneário Camboriú e região.", date: "2025-03-08", replied: true },
                      { name: "João S.", rating: 5, text: "Presente em grande parte do território brasileiro!!!", date: "2025-03-05", replied: false },
                    ].map((review, i) => (
                      <Card key={i} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">{review.name[0]}</div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{review.name}</p>
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: review.rating }).map((_, j) => (
                                    <Star key={j} className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                  ))}
                                </div>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">"{review.text}"</p>
                            <p className="text-xs text-muted-foreground mt-1">{new Date(review.date).toLocaleDateString("pt-BR")}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {review.replied ? (
                              <Badge className="bg-green-500/10 text-green-500 border-green-500/30">Respondida</Badge>
                            ) : (
                              <Button size="sm" variant="outline"><Reply className="h-3 w-3 mr-1" /> Responder</Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Q&A */}
              {activeTab === "qna" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Perguntas e Respostas</h3>
                    <p className="text-sm text-muted-foreground">Gerencie as perguntas feitas pelos clientes no seu perfil.</p>
                  </div>

                  <Card className="p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">Adicionar Pergunta Frequente</h4>
                    <div><Label>Pergunta</Label><Input placeholder="Ex: Vocês atendem no aeroporto de Guarulhos?" /></div>
                    <div><Label>Resposta</Label><Textarea placeholder="Sim, atendemos todos os aeroportos..." /></div>
                    <Button variant="outline" size="sm"><CirclePlus className="h-4 w-4 mr-2" /> Publicar Pergunta</Button>
                  </Card>

                  <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                    <Info className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-xs text-muted-foreground">Publique perguntas frequentes para ajudar os clientes a encontrar informações rapidamente.</p>
                  </div>
                </div>
              )}

              {/* ATTRIBUTES */}
              {activeTab === "attributes" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Atributos do Negócio</h3>
                    <p className="text-sm text-muted-foreground">Informe características e facilidades oferecidas.</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { key: "wheelchair", label: "Acessibilidade para cadeirantes", icon: Accessibility },
                      { key: "wifi", label: "Wi-Fi disponível", icon: Wifi },
                      { key: "parking", label: "Estacionamento", icon: ParkingCircle },
                      { key: "creditCard", label: "Aceita cartão de crédito", icon: CreditCard },
                      { key: "appointment", label: "Agendamento necessário", icon: Calendar },
                      { key: "onlineBooking", label: "Reserva online", icon: Globe },
                      { key: "lgbtFriendly", label: "LGBT-friendly", icon: Award },
                      { key: "petFriendly", label: "Pet-friendly", icon: ThumbsUp },
                    ].map((attr) => {
                      const Icon = attr.icon;
                      return (
                        <div key={attr.key} className="flex items-center justify-between p-3 rounded-lg border border-border">
                          <div className="flex items-center gap-3">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-foreground">{attr.label}</span>
                          </div>
                          <Switch
                            checked={attributes[attr.key as keyof typeof attributes]}
                            onCheckedChange={(v) => setAttributes({ ...attributes, [attr.key]: v })}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Métodos de Pagamento</h4>
                    <div className="flex flex-wrap gap-2">
                      {["Dinheiro", "PIX", "Cartão de Crédito", "Cartão de Débito", "Transferência Bancária"].map((method) => (
                        <Badge key={method} variant="outline" className="cursor-pointer hover:bg-primary/10 transition-colors px-3 py-1.5">{method}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Idiomas Atendidos</h4>
                    <div className="flex flex-wrap gap-2">
                      {["Português", "Inglês", "Espanhol", "Francês", "Italiano"].map((lang) => (
                        <Badge key={lang} variant="outline" className="cursor-pointer hover:bg-primary/10 transition-colors px-3 py-1.5">{lang}</Badge>
                      ))}
                    </div>
                  </div>

                  <Button className="bg-primary text-primary-foreground"><Send className="h-4 w-4 mr-2" /> Salvar Atributos</Button>
                </div>
              )}

              {/* PERFORMANCE */}
              {activeTab === "performance" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Desempenho e Métricas</h3>
                    <p className="text-sm text-muted-foreground">Acompanhe como os clientes interagem com seu perfil.</p>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Card className="p-4 text-center">
                      <Eye className="h-6 w-6 text-primary mx-auto mb-1" />
                      <p className="text-2xl font-bold text-foreground">828</p>
                      <p className="text-xs text-muted-foreground">Visualizações</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <MousePointerClick className="h-6 w-6 text-primary mx-auto mb-1" />
                      <p className="text-2xl font-bold text-foreground">156</p>
                      <p className="text-xs text-muted-foreground">Cliques no Site</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <PhoneCall className="h-6 w-6 text-primary mx-auto mb-1" />
                      <p className="text-2xl font-bold text-foreground">89</p>
                      <p className="text-xs text-muted-foreground">Ligações</p>
                    </Card>
                    <Card className="p-4 text-center">
                      <Navigation className="h-6 w-6 text-primary mx-auto mb-1" />
                      <p className="text-2xl font-bold text-foreground">234</p>
                      <p className="text-xs text-muted-foreground">Direções Solicitadas</p>
                    </Card>
                  </div>

                  <Card className="p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3">Como os clientes encontram você</h4>
                    <div className="space-y-3">
                      {[
                        { label: "Pesquisa Direta", value: 45, color: "bg-primary" },
                        { label: "Pesquisa por Descoberta", value: 35, color: "bg-blue-500" },
                        { label: "Pesquisa de Marca", value: 20, color: "bg-green-500" },
                      ].map((item) => (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="text-foreground font-medium">{item.value}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3">Ações dos Clientes (últimos 28 dias)</h4>
                    <div className="space-y-2">
                      {[
                        { label: "Visitaram o site", value: "156" },
                        { label: "Pediram direções", value: "234" },
                        { label: "Ligaram para você", value: "89" },
                        { label: "Enviaram mensagem", value: "67" },
                        { label: "Viram suas fotos", value: "412" },
                      ].map((item) => (
                        <div key={item.label} className="flex justify-between py-2 border-b border-border last:border-0">
                          <span className="text-sm text-muted-foreground">{item.label}</span>
                          <span className="text-sm font-medium text-foreground">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </div>
    );
  }

  if (hasProfile) {
    return (
      <div className="space-y-6">
        <SlideCarousel
          pagina="google"
          breakoutTop={false}
          fallbackSlides={[
            { titulo: "Coloque Sua Empresa no Google", subtitulo: "Crie seu perfil no Google Business Profile e apareça nas buscas quando clientes procurarem por transporte executivo na sua região." },
            { titulo: "Perfil Verificado no Google", subtitulo: "Motoristas com perfil verificado passam mais confiança. Hotéis e empresas encontram você diretamente no Google Maps." },
            { titulo: "Aumente Sua Visibilidade", subtitulo: "Destaque-se nos resultados de busca com avaliações positivas e informações completas do seu serviço." },
          ]}
        />
        {googleFerramentaBloqueada && <FerramentaBetaBloqueioAviso />}
        <FerramentaConstrucaoOverlay disabled={googleFerramentaBloqueada} className="space-y-6">
          {pendingBanner}
          {activeBanner}
          <div>
            <h2 className="text-xl font-bold text-foreground">Gerenciar Perfil Google Business</h2>
            <p className="text-sm text-muted-foreground">Edite todas as informações do seu perfil no Google.</p>
          </div>
          {renderManagementInline()}
        </FerramentaConstrucaoOverlay>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SlideCarousel
        pagina="google"
        fallbackSlides={[
          { titulo: "Coloque Sua Empresa no Google", subtitulo: "Crie seu perfil no Google Business Profile e apareça nas buscas quando clientes procurarem por transporte executivo na sua região." },
          { titulo: "Perfil Verificado no Google", subtitulo: "Motoristas com perfil verificado passam mais confiança. Hotéis e empresas encontram você diretamente no Google Maps." },
          { titulo: "Aumente Sua Visibilidade", subtitulo: "Destaque-se nos resultados de busca com avaliações positivas e informações completas do seu serviço." },
        ]}
      />

      {googleFerramentaBloqueada && <FerramentaBetaBloqueioAviso />}

      <FerramentaConstrucaoOverlay disabled={googleFerramentaBloqueada} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Google Business Profile</h2>
            <p className="text-muted-foreground">Crie seu perfil no Google Meu Negócio</p>
          </div>
          <Button
            onClick={() => {
              if (!googleConsumoLiberado) {
                toast.error("Esta ferramenta ainda não está disponível para uso. Aguarde a liberação da plataforma.");
                return;
              }
              if (!hasPlan("pro")) {
                setUpgradeOpen(true);
                return;
              }
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Novo Perfil
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2"><Shield className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium text-foreground">Como funciona</span></div>
          <p className="text-sm text-muted-foreground">
            O cadastro segue o modelo <strong className="text-foreground">Service Area Business (SAB)</strong>: endereço residencial só para verificação
            (oculto no Maps), categoria e site definidos pela plataforma, áreas de atendimento com busca de cidades e telefone exclusivo na rede.
            Isso reduz risco de banimento da conta Google usada pela API.
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium mb-1">Nenhum perfil criado</p>
          <p className="text-sm text-muted-foreground mb-4">Crie seu perfil no Google Business para aparecer nas buscas.</p>
          <Button
            onClick={() => {
              if (!googleConsumoLiberado) {
                toast.error("Esta ferramenta ainda não está disponível para uso. Aguarde a liberação da plataforma.");
                return;
              }
              if (!hasPlan("pro")) {
                setUpgradeOpen(true);
                return;
              }
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Criar Meu Perfil
          </Button>
        </div>
      </FerramentaConstrucaoOverlay>

      <GoogleBusinessSolicitationDialog
        open={createOpen && googleConsumoLiberado}
        onOpenChange={setCreateOpen}
        onSuccess={() => void refreshServicoGoogle()}
      />
      <UpgradePlanDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        selfServiceUpgrade={plano === "free"}
        onUpgradeSuccess={() => void refetchPlano()}
      />
    </div>
  );
}
