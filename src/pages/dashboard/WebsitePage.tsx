import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

// Template data
const templates = [
  { id: "dark1", name: "Executive Dark 1", category: "dark", headline: "Transporte Executivo\nde Alto Padrão", style: "bg-gradient-to-br from-neutral-900 to-neutral-800 text-amber-400" },
  { id: "dark3", name: "Executive Dark 3", category: "dark", headline: "CONTROLE\nABSOLUTO\nEM CADA\nTRAJETO", style: "bg-gradient-to-br from-neutral-900 to-neutral-700 text-white" },
  { id: "dark2", name: "Executive Dark 2", category: "dark", headline: "PRECISÃO\nINDUSTRIAL\nEM CADA OPERAÇÃO", style: "bg-gradient-to-br from-neutral-900 to-neutral-800 text-amber-500" },
  { id: "eco1", name: "Executive Ecological 1", category: "eco", headline: "Transporte Executivo\nque Respeita o Planeta", style: "bg-gradient-to-br from-green-900 to-emerald-800 text-white" },
  { id: "eco2", name: "Executive Ecological 2", category: "eco", headline: "Viagens\ntranquilas,\nnaturalmente.", style: "bg-gradient-to-br from-emerald-800 to-green-700 text-white" },
  { id: "cream2", name: "Executive Cream 2", category: "cream", headline: "Segurança,\npontualidade\ne estilo", style: "bg-gradient-to-br from-stone-200 to-stone-100 text-stone-800" },
  { id: "cream3", name: "Executive Cream 3", category: "cream", headline: "Cada detalhe\npensado para\nvocê", style: "bg-gradient-to-br from-stone-100 to-amber-50 text-stone-800" },
  { id: "cream1", name: "Executive Cream 1", category: "cream", headline: "Silêncio.\nBem-estar.\nMovimento.", style: "bg-gradient-to-br from-stone-800 to-stone-700 text-white" },
  { id: "cream4", name: "Executive Cream 4", category: "cream", headline: "Seu momento\nde serenidade\ncomeça aqui", style: "bg-gradient-to-br from-stone-300 to-stone-200 text-stone-800" },
  { id: "cream5", name: "Executive Cream 5", category: "cream", headline: "Luxo é não\nprecisar\ndizer nada", style: "bg-gradient-to-br from-stone-700 to-stone-600 text-white" },
  { id: "summer", name: "Executive Summer", category: "summer", headline: "Seu verão\nmerece um\ntransfer premium", style: "bg-gradient-to-br from-red-600 to-orange-500 text-white" },
  { id: "system1", name: "Executive System 1", category: "system", headline: "Transporte Executivo\nBlindado e Pontual", style: "bg-gradient-to-br from-neutral-800 to-neutral-700 text-white" },
  { id: "system", name: "Executive System", category: "system", headline: "Transporte Executivo de Alto\nPadrão", style: "bg-gradient-to-br from-blue-900 to-blue-800 text-white" },
  { id: "flora", name: "Executivo Flora", category: "flora", headline: "Tradição &\nPontualidade\nem Cada Trajeto", style: "bg-gradient-to-br from-stone-100 to-stone-50 text-stone-800" },
];

const heroSlides = [
  { title: "Crie Seu Site Profissional", desc: "Tenha presença online com um site exclusivo para transporte executivo. Design premium e responsivo." },
  { title: "Templates Exclusivos", desc: "Escolha entre diversos modelos desenvolvidos especialmente para o segmento de transporte executivo." },
  { title: "100% Personalizado", desc: "Cores, textos e funcionalidades sob medida para sua empresa." },
];

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
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>("eco1");
  const [step, setStep] = useState<"gallery" | "briefing">("gallery");
  const [briefingStep, setBriefingStep] = useState(1);
  const [heroIndex, setHeroIndex] = useState(0);

  // Briefing form state
  const [domain, setDomain] = useState("");
  const [provider, setProvider] = useState("");
  const [hasDomain, setHasDomain] = useState(false);
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

  const selectedTemplateName = templates.find(t => t.id === selectedTemplate)?.name || "";

  if (step === "briefing") {
    return (
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
              <h2 className="text-lg font-bold text-foreground">Domínio Desejado</h2>
            </div>
            <p className="text-sm text-muted-foreground">Informe o domínio que deseja para seu site. Nós verificaremos a disponibilidade e entraremos em contato.</p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Domínio desejado <span className="text-destructive">*</span></label>
                <Input value={domain} onChange={e => setDomain(e.target.value)} placeholder="www.seudominio.com.br" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Provedor atual (se já possui domínio)</label>
                <Input value={provider} onChange={e => setProvider(e.target.value)} placeholder="Hostinger, GoDaddy, etc." className="mt-1" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={hasDomain} onCheckedChange={(v) => setHasDomain(!!v)} />
                <span className="text-sm text-foreground">Já possuo este domínio e tenho acesso ao DNS</span>
              </div>
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
            else alert("Briefing enviado com sucesso!");
          }} className="bg-primary text-primary-foreground">
            {briefingStep < 3 ? "Próximo" : "Revisar e Enviar"} <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // Gallery view
  return (
    <div className="space-y-6">
      {/* Hero Carousel */}
      <div className="relative rounded-xl overflow-hidden h-72 bg-gradient-to-r from-neutral-900 to-neutral-700">
        <div className="absolute inset-0 flex flex-col justify-end p-8">
          <p className="text-xs uppercase tracking-widest text-neutral-400 mb-1">Professional Executive Transportation</p>
          <h2 className="text-2xl font-bold text-white">{heroSlides[heroIndex].title}</h2>
          <p className="text-sm text-neutral-300 mt-1 max-w-lg">{heroSlides[heroIndex].desc}</p>
        </div>
        <button onClick={() => setHeroIndex((heroIndex - 1 + heroSlides.length) % heroSlides.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button onClick={() => setHeroIndex((heroIndex + 1) % heroSlides.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {heroSlides.map((_, i) => (
            <button key={i} onClick={() => setHeroIndex(i)} className={cn("w-2.5 h-2.5 rounded-full", i === heroIndex ? "bg-white" : "bg-white/40")} />
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Website</h1>
        <p className="text-muted-foreground">Escolha o modelo ideal para o seu site profissional.</p>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {templates.map(t => {
          const isSelected = selectedTemplate === t.id;
          return (
            <div key={t.id} className="flex flex-col">
              {/* Preview card */}
              <div className={cn("rounded-xl h-44 p-5 flex flex-col justify-end relative overflow-hidden border", t.style, isSelected ? "ring-2 ring-primary" : "border-border")}>
                <p className="text-xs font-bold whitespace-pre-line leading-tight">{t.headline}</p>
                {isSelected && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
              <p className="font-semibold text-foreground mt-3 text-sm">{t.name}</p>
              <Button variant="outline" size="sm" className="mt-2 w-full gap-2">
                <Eye className="h-4 w-4" /> Ver Modelo
              </Button>
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
