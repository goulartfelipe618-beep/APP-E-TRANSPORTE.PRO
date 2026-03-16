import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  Globe,
  ArrowLeft,
  ArrowRight,
  Monitor,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CheckCircle2, Calendar, Info } from "lucide-react";
import SlideCarousel from "@/components/SlideCarousel";

interface TemplateDB {
  id: string;
  nome: string;
  imagem_url: string;
  link_modelo: string;
  ordem: number;
  ativo: boolean;
}


const serviceTypes = [
  { id: "transfer", label: "Transfer Executivo" },
  { id: "grupos", label: "Transporte para Grupos" },
  { id: "excursoes", label: "Excursões" },
  { id: "corporativo", label: "Transporte Corporativo" },
  { id: "aeroporto", label: "Transporte para Aeroporto" },
  { id: "produtos", label: "Venda de Produtos Online" },
];

const features = [
  { id: "whatsapp", label: "Botão WhatsApp" },
  { id: "orcamento", label: "Formulário de orçamento" },
  { id: "maps", label: "Integração com Google Maps" },
  { id: "gbp", label: "Integração com Google Business Profile" },
  { id: "grupos", label: "Área para grupos/excursões" },
  { id: "produtos", label: "Área de produtos online" },
  { id: "blog", label: "Blog" },
  { id: "admin", label: "Área administrativa futura" },
];

export default function WebsitePage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [step, setStep] = useState<"gallery" | "briefing" | "servico_ativo">("gallery");
  const [briefingStep, setBriefingStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [servicoAtivo, setServicoAtivo] = useState<any>(null);
  const [dbTemplates, setDbTemplates] = useState<TemplateDB[]>([]);

  // Briefing form state
  const [domain, setDomain] = useState("");
  const [provider, setProvider] = useState("");
  const [hasDomain, setHasDomain] = useState(false);
  const [domainResult, setDomainResult] = useState<{ available: boolean | null; message: string } | null>(null);
  const [checkingDomain, setCheckingDomain] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>(["transfer", "grupos", "excursoes", "corporativo", "aeroporto"]);
  const [companyName, setCompanyName] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [fleet, setFleet] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [differentials, setDifferentials] = useState("");
  const [socialMedia, setSocialMedia] = useState("");
  const [works24h, setWorks24h] = useState(true);
  const [targetAudience, setTargetAudience] = useState("");
  const [priceRange, setPriceRange] = useState("Premium");
  const [wantsBudgetForm, setWantsBudgetForm] = useState(true);
  const [wantsWhatsappIntegration, setWantsWhatsappIntegration] = useState(true);
  const [hasLogo, setHasLogo] = useState(false);
  const [preferredColors, setPreferredColors] = useState("");
  const [desiredStyle, setDesiredStyle] = useState("Minimalista");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(features.map(f => f.id));

  const toggleService = (id: string) => {
    setSelectedServices(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };
  const toggleFeature = (id: string) => {
    setSelectedFeatures(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const handleCheckDomain = async () => {
    if (!domain.trim()) { toast.error("Informe um domínio"); return; }
    setCheckingDomain(true);
    setDomainResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("check-domain", {
        body: { domain: domain.trim() },
      });
      if (error) throw error;
      setDomainResult({ available: data.available, message: data.message });
    } catch (err: any) {
      toast.error("Erro ao verificar domínio");
      setDomainResult({ available: null, message: "Não foi possível verificar. Tente novamente." });
    }
    setCheckingDomain(false);
  };

  const selectedTemplateName = dbTemplates.find(t => t.id === selectedTemplate)?.nome || "";

  // Fetch templates from DB
  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await (supabase.from("templates_website" as any).select("*").eq("ativo", true).order("ordem", { ascending: true }) as any);
      if (data) setDbTemplates(data);
    };
    fetchTemplates();
  }, []);

  // Check for existing active service
  useEffect(() => {
    const checkServico = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase.from("solicitacoes_servicos" as any).select("*").eq("user_id", user.id).eq("tipo_servico", "website").order("created_at", { ascending: false }).limit(1) as any);
      if (data && data.length > 0) {
        const s = data[0];
        if (s.status === "concluido") {
          setServicoAtivo(s);
          setStep("servico_ativo");
        } else if (s.status === "pendente" || s.status === "em_andamento") {
          setServicoAtivo(s);
        }
      }
    };
    checkServico();
  }, []);

  const handleSubmitSolicitacao = async () => {
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não autenticado"); setSubmitting(false); return; }
    const { error } = await (supabase.from("solicitacoes_servicos" as any).insert({
      user_id: user.id,
      tipo_servico: "website",
      dados_solicitacao: {
        template: selectedTemplateName,
        template_id: selectedTemplate,
        dominio: domain,
        provedor: provider,
        possui_dominio: hasDomain,
        servicos: selectedServices,
        nome_empresa: companyName,
        cidade: city,
        regiao: region,
        frota: fleet,
        whatsapp,
        email,
        diferenciais: differentials,
        redes_sociais: socialMedia,
        trabalha_24h: works24h,
        publico_alvo: targetAudience,
        faixa_preco: priceRange,
        formulario_orcamento: wantsBudgetForm,
        integracao_whatsapp: wantsWhatsappIntegration,
        possui_logo: hasLogo,
        cores_preferidas: preferredColors,
        estilo: desiredStyle,
        funcionalidades: selectedFeatures,
      },
    } as any) as any);
    setSubmitting(false);
    if (error) { toast.error("Erro ao enviar: " + error.message); return; }
    toast.success("Solicitação enviada com sucesso! O administrador irá processar seu pedido.");
    setBriefingStep(1);
    setStep("gallery");
  };

  // Active service view
  if (step === "servico_ativo" && servicoAtivo) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-primary" /> Website — Serviço Ativo
          </h1>
          <p className="text-muted-foreground">Seu website foi configurado e está pronto para uso.</p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-card p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <p className="text-foreground font-medium flex items-center gap-1">
                  <Calendar className="h-4 w-4" /> {new Date(servicoAtivo.data_expiracao).toLocaleDateString("pt-BR")}
                </p>
              </div>
            )}
          </div>
          {servicoAtivo.instrucoes_acesso && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Instruções de Acesso</p>
              <p className="text-foreground whitespace-pre-wrap">{servicoAtivo.instrucoes_acesso}</p>
            </div>
          )}
          {servicoAtivo.como_usar && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Como Usar</p>
              <p className="text-foreground whitespace-pre-wrap">{servicoAtivo.como_usar}</p>
            </div>
          )}
          {servicoAtivo.observacoes_admin && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
              <p className="text-sm font-medium text-foreground flex items-center gap-1"><Info className="h-4 w-4" /> Observações</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{servicoAtivo.observacoes_admin}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show pending banner if exists
  const pendingBanner = servicoAtivo && (servicoAtivo.status === "pendente" || servicoAtivo.status === "em_andamento") ? (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-center gap-3">
      <Info className="h-5 w-5 text-yellow-600" />
      <div>
        <p className="text-sm font-semibold text-foreground">Solicitação em análise</p>
        <p className="text-xs text-muted-foreground">Sua solicitação de website está sendo processada pelo administrador. Status: <Badge variant="outline">{servicoAtivo.status === "pendente" ? "Pendente" : "Em andamento"}</Badge></p>
      </div>
    </div>
  ) : null;

  if (step === "briefing") {
    return (
      <>
      {pendingBanner}
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Website — Briefing</h1>
          <p className="text-sm text-muted-foreground">
            Modelo: <span className="font-semibold text-foreground">{selectedTemplateName}</span>{" "}
            <button onClick={() => setStep("gallery")} className="text-primary hover:underline">(alterar)</button>
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-sm">
          {[{ n: 1, label: "Domínio" }, { n: 2, label: "Briefing" }, { n: 3, label: "Enviar" }].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                briefingStep >= s.n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>{s.n}</div>
              <span className={cn(briefingStep >= s.n ? "text-primary font-medium" : "text-muted-foreground")}>{s.label}</span>
              {i < 2 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Step 1: Domain */}
         {briefingStep === 1 && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-6">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-foreground" />
              <h2 className="text-lg font-bold text-foreground">Escolha seu domínio</h2>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Você já tem um domínio?</p>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={!hasDomain} onChange={() => { setHasDomain(false); setDomainResult(null); }} className="accent-primary" />
                  <span className="text-sm text-foreground">Quero registrar um novo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={hasDomain} onChange={() => { setHasDomain(true); setDomainResult(null); }} className="accent-primary" />
                  <span className="text-sm text-foreground">Já tenho um domínio</span>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">
                  {hasDomain ? "Seu domínio atual" : "Nome desejado para o domínio"}
                </label>
                <Input
                  value={domain}
                  onChange={e => { setDomain(e.target.value); setDomainResult(null); }}
                  placeholder={hasDomain ? "meudominio.com.br" : "suaempresa.com.br"}
                  className="mt-1"
                />
                {!hasDomain && (
                  <p className="text-xs text-muted-foreground mt-1">Pesquise a disponibilidade antes de continuar.</p>
                )}
              </div>

              {!hasDomain && (
                <Button
                  variant="outline"
                  onClick={handleCheckDomain}
                  disabled={checkingDomain || !domain.trim()}
                >
                  {checkingDomain ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verificando...</>
                  ) : (
                    <><Globe className="h-4 w-4 mr-2" /> Pesquisar Domínio</>
                  )}
                </Button>
              )}

              {domainResult && (
                <div className={cn(
                  "rounded-lg border p-4 flex items-start gap-3",
                  domainResult.available === true && "border-green-500/30 bg-green-500/10",
                  domainResult.available === false && "border-destructive/30 bg-destructive/10",
                  domainResult.available === null && "border-border bg-muted/30",
                )}>
                  {domainResult.available === true && <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />}
                  {domainResult.available === false && <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
                  {domainResult.available === null && <Globe className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />}
                  <div>
                    <p className={cn(
                      "text-sm font-semibold",
                      domainResult.available === true && "text-green-500",
                      domainResult.available === false && "text-destructive",
                    )}>
                      {domainResult.message}
                    </p>
                    {domainResult.available === false && (
                      <p className="text-xs text-muted-foreground mt-1">Tente outro nome ou variação.</p>
                    )}
                  </div>
                </div>
              )}

              {hasDomain && (
                <div>
                  <label className="text-sm font-medium text-foreground">Provedor atual</label>
                  <Input value={provider} onChange={e => setProvider(e.target.value)} placeholder="Hostinger, GoDaddy, Registro.br, etc." className="mt-1" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Briefing */}
        {briefingStep === 2 && (
          <div className="space-y-6">
            {/* Tipo de Serviço */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h2 className="text-lg font-bold text-foreground">Tipo de Serviço</h2>
              {serviceTypes.map(s => (
                <div key={s.id} className="flex items-center gap-2">
                  <Checkbox checked={selectedServices.includes(s.id)} onCheckedChange={() => toggleService(s.id)} />
                  <span className="text-sm text-foreground">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Estrutura da Empresa */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h2 className="text-lg font-bold text-foreground">Estrutura da Empresa</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-foreground">Nome da empresa</label><Input value={companyName} onChange={e => setCompanyName(e.target.value)} className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">Cidade principal</label><Input value={city} onChange={e => setCity(e.target.value)} className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">Região atendida</label><Input value={region} onChange={e => setRegion(e.target.value)} className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">Frota</label><Input value={fleet} onChange={e => setFleet(e.target.value)} className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">WhatsApp</label><Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">E-mail profissional</label><Input value={email} onChange={e => setEmail(e.target.value)} className="mt-1" /></div>
              </div>
              <div><label className="text-sm font-medium text-foreground">Diferenciais</label><Textarea value={differentials} onChange={e => setDifferentials(e.target.value)} placeholder="Sem diferenciais" className="mt-1" /></div>
            </div>

            {/* Redes sociais */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h2 className="text-lg font-bold text-foreground">Redes sociais</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <Input value={socialMedia} onChange={e => setSocialMedia(e.target.value)} placeholder="@sua.empresa" />
                <div className="flex items-center gap-2">
                  <Checkbox checked={works24h} onCheckedChange={(v) => setWorks24h(!!v)} />
                  <span className="text-sm text-foreground">Trabalha 24h?</span>
                </div>
              </div>
            </div>

            {/* Posicionamento */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h2 className="text-lg font-bold text-foreground">Posicionamento</h2>
              <div><label className="text-sm font-medium text-foreground">Público-alvo</label><Input value={targetAudience} onChange={e => setTargetAudience(e.target.value)} className="mt-1" /></div>
              <div>
                <label className="text-sm font-medium text-foreground">Faixa de preço</label>
                <Select value={priceRange} onValueChange={setPriceRange}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Econômico">Econômico</SelectItem>
                    <SelectItem value="Intermediário">Intermediário</SelectItem>
                    <SelectItem value="Premium">Premium</SelectItem>
                    <SelectItem value="Luxo">Luxo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2"><Checkbox checked={wantsBudgetForm} onCheckedChange={(v) => setWantsBudgetForm(!!v)} /><span className="text-sm text-foreground">Captação de orçamento pelo site?</span></div>
              <div className="flex items-center gap-2"><Checkbox checked={wantsWhatsappIntegration} onCheckedChange={(v) => setWantsWhatsappIntegration(!!v)} /><span className="text-sm text-foreground">Integração com WhatsApp?</span></div>
            </div>

            {/* Identidade Visual */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h2 className="text-lg font-bold text-foreground">Identidade Visual</h2>
              <div className="flex items-center gap-2"><Checkbox checked={hasLogo} onCheckedChange={(v) => setHasLogo(!!v)} /><span className="text-sm text-foreground">Já possui logotipo?</span></div>
              <div><label className="text-sm font-medium text-foreground">Cores preferidas</label><Input value={preferredColors} onChange={e => setPreferredColors(e.target.value)} className="mt-1" /></div>
              <div>
                <label className="text-sm font-medium text-foreground">Estilo desejado</label>
                <Select value={desiredStyle} onValueChange={setDesiredStyle}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Minimalista">Minimalista</SelectItem>
                    <SelectItem value="Moderno">Moderno</SelectItem>
                    <SelectItem value="Clássico">Clássico</SelectItem>
                    <SelectItem value="Sofisticado">Sofisticado</SelectItem>
                    <SelectItem value="Ousado">Ousado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Funcionalidades Desejadas */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h2 className="text-lg font-bold text-foreground">Funcionalidades Desejadas</h2>
              {features.map(f => (
                <div key={f.id} className="flex items-center gap-2">
                  <Checkbox checked={selectedFeatures.includes(f.id)} onCheckedChange={() => toggleFeature(f.id)} />
                  <span className="text-sm text-foreground">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {briefingStep === 3 && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground">Revisão</h2>
            <p className="text-sm text-muted-foreground">Revise suas informações antes de enviar o briefing.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Modelo:</span> <span className="text-foreground font-medium">{selectedTemplateName}</span></div>
              <div><span className="text-muted-foreground">Domínio:</span> <span className="text-foreground font-medium">{domain || "—"}</span></div>
              <div><span className="text-muted-foreground">Empresa:</span> <span className="text-foreground font-medium">{companyName || "—"}</span></div>
              <div><span className="text-muted-foreground">Cidade:</span> <span className="text-foreground font-medium">{city || "—"}</span></div>
              <div><span className="text-muted-foreground">WhatsApp:</span> <span className="text-foreground font-medium">{whatsapp || "—"}</span></div>
              <div><span className="text-muted-foreground">E-mail:</span> <span className="text-foreground font-medium">{email || "—"}</span></div>
              <div><span className="text-muted-foreground">Estilo:</span> <span className="text-foreground font-medium">{desiredStyle}</span></div>
              <div><span className="text-muted-foreground">Faixa de preço:</span> <span className="text-foreground font-medium">{priceRange}</span></div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <Button variant="outline" onClick={() => {
            if (briefingStep === 1) setStep("gallery");
            else setBriefingStep(s => s - 1);
          }}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <Button onClick={() => {
            if (briefingStep < 3) setBriefingStep(s => s + 1);
            else handleSubmitSolicitacao();
          }} className="bg-primary text-primary-foreground" disabled={submitting}>
            {briefingStep < 3 ? "Próximo" : (submitting ? "Enviando..." : "Revisar e Enviar")} <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
      </>
    );
  }

  // Gallery view
  return (
    <div className="space-y-6">
      {pendingBanner}
      {/* Hero Carousel */}
      <SlideCarousel
        pagina="website"
        fallbackSlides={[
          { titulo: "Crie Seu Site Profissional", subtitulo: "Tenha presença online com um site exclusivo para transporte executivo. Design premium e responsivo." },
          { titulo: "Templates Exclusivos", subtitulo: "Escolha entre diversos modelos desenvolvidos especialmente para o segmento de transporte executivo." },
          { titulo: "100% Personalizado", subtitulo: "Cores, textos e funcionalidades sob medida para sua empresa." },
        ]}
      />

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Website</h1>
        <p className="text-muted-foreground">Escolha o modelo ideal para o seu site profissional.</p>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {dbTemplates.map(t => {
          const isSelected = selectedTemplate === t.id;
          return (
            <div key={t.id} className="flex flex-col">
              {/* Preview card with scroll-on-hover */}
              <div className={cn("rounded-xl h-48 relative overflow-hidden border bg-muted group cursor-pointer", isSelected ? "ring-2 ring-primary" : "border-border")}
                onClick={() => setSelectedTemplate(t.id)}>
                {t.imagem_url ? (
                  <img
                    src={t.imagem_url}
                    alt={t.nome}
                    className="w-full object-cover object-top transition-transform duration-[8s] ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:translate-y-[calc(-100%+12rem)]"
                    style={{ minHeight: "200%" }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">Sem imagem</div>
                )}
                {isSelected && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center z-10">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
              <p className="font-semibold text-foreground mt-3 text-sm">{t.nome}</p>
              {t.link_modelo && (
                <a href={t.link_modelo} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="mt-2 w-full gap-2">
                    <Eye className="h-4 w-4" /> Ver Modelo
                  </Button>
                </a>
              )}
              {isSelected ? (
                <Button size="sm" className="mt-2 w-full gap-2 bg-primary text-primary-foreground">
                  <Check className="h-4 w-4" /> Selecionado
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setSelectedTemplate(t.id)}>
                  Selecionar
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {dbTemplates.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum template disponível no momento.
        </div>
      )}

      {/* Floating CTA */}
      {selectedTemplate && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button onClick={() => { setStep("briefing"); setBriefingStep(1); }} className="gap-2 shadow-lg bg-primary text-primary-foreground px-6">
            <Monitor className="h-4 w-4" /> Continuar com este modelo <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
