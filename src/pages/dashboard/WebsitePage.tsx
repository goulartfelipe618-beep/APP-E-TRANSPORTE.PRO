import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, ArrowRight, Monitor, Eye, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CheckCircle2, Calendar, Info } from "lucide-react";
import SlideCarousel from "@/components/SlideCarousel";
import { useUserPlan } from "@/hooks/useUserPlan";
import UpgradePlanDialog from "@/components/planos/UpgradePlanDialog";
import {
  DomainSelectionCard,
  canAdvanceFromDomainSelection,
  type DomainOption,
} from "@/components/domain/DomainSelectionCard";

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
  "Orçamento online", "Destinos atendidos", "Blog", "Depoimentos de clientes",
];

const INTEGRATION_OPTIONS = [
  "WhatsApp", "Google Maps", "Google Business", "Instagram", "Sistema de reservas", "Pagamento online",
];

const STYLE_OPTIONS = ["Minimalista", "Luxo", "Corporativo", "Moderno", "Turístico"];

const PLATFORM_OPTIONS = ["Uber Black", "99", "InDriver", "Particular"];

const PRICE_OPTIONS = ["Econômico", "Intermediário", "Premium", "Luxo"];

// ── Steps config ─────────────────────────────────────
const STEPS = [
  { n: 1, label: "Domínio" },
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
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [step, setStep] = useState<"gallery" | "briefing" | "servico_ativo">("gallery");
  const [bs, setBs] = useState(1); // briefing step
  const [submitting, setSubmitting] = useState(false);
  const [servicoAtivo, setServicoAtivo] = useState<any>(null);
  const [dbTemplates, setDbTemplates] = useState<TemplateDB[]>([]);
  const { plano, refetch: refetchPlano } = useUserPlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Step 1 - Domínio (alinhado ao wizard E-mail Business)
  const [domain, setDomain] = useState("");
  const [domainOption, setDomainOption] = useState<DomainOption>("new");
  const [provider, setProvider] = useState("");
  const [domainChecked, setDomainChecked] = useState(false);
  const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null);
  const [domainMessage, setDomainMessage] = useState("");
  const [checkingDomain, setCheckingDomain] = useState(false);

  const resetDomainCheck = () => {
    setDomainChecked(false);
    setDomainAvailable(null);
    setDomainMessage("");
  };

  // Step 2 - Empresa
  const [companyName, setCompanyName] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [telefoneSecundario, setTelefoneSecundario] = useState("");
  const [email, setEmail] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cidadeSede, setCidadeSede] = useState("");
  const [regiaoAtendida, setRegiaoAtendida] = useState("");
  const [hasLogo, setHasLogo] = useState(false);
  const [preferredColors, setPreferredColors] = useState("");
  const [desiredStyle, setDesiredStyle] = useState("Minimalista");

  // Step 3 - Serviços
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [servicoOutro, setServicoOutro] = useState("");

  // Step 4 - Aeroportos e destinos
  const [aeroportos, setAeroportos] = useState("");
  const [rotas, setRotas] = useState("");

  // Step 5 - Frota
  const [veiculos, setVeiculos] = useState("");
  const [amenidades, setAmenidades] = useState<string[]>([]);

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
    const checkServico = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase.from("solicitacoes_servicos" as any).select("*").eq("user_id", user.id).eq("tipo_servico", "website").order("created_at", { ascending: false }).limit(1) as any);
      if (data && data.length > 0) {
        const s = data[0];
        if (s.status === "concluido") { setServicoAtivo(s); setStep("servico_ativo"); }
        else if (s.status === "pendente" || s.status === "em_andamento") { setServicoAtivo(s); }
      }
    };
    checkServico();
  }, []);

  // ── Handlers ───────────────────────────────────────
  const handleCheckDomain = async () => {
    if (!domain.trim() || !domain.includes(".")) {
      toast.error("Informe um domínio válido (ex: suaempresa.com.br)");
      return;
    }
    setCheckingDomain(true);
    setDomainChecked(false);
    setDomainAvailable(null);
    setDomainMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("check-domain", {
        body: { domain: domain.trim() },
      });
      if (error) throw error;
      setDomainChecked(true);
      setDomainAvailable(data.available === true);
      setDomainMessage(data.message || "");
      if (data.available) {
        toast.success("Domínio disponível!");
      } else {
        toast.error(data.message || "Domínio indisponível");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      toast.error("Erro ao verificar domínio: " + msg);
    } finally {
      setCheckingDomain(false);
    }
  };

  const selectedTemplateName = dbTemplates.find(t => t.id === selectedTemplate)?.nome || "";

  const handleSubmitSolicitacao = async () => {
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não autenticado"); setSubmitting(false); return; }
    const { error } = await (supabase.from("solicitacoes_servicos" as any).insert({
      user_id: user.id,
      tipo_servico: "website",
      dados_solicitacao: {
        template: selectedTemplateName, template_id: selectedTemplate,
        dominio: domain,
        tipo_dominio: domainOption,
        provedor: provider,
        possui_dominio: domainOption === "existing",
        nome_empresa: companyName, responsavel, whatsapp, telefone_secundario: telefoneSecundario,
        email, cnpj, cidade_sede: cidadeSede, regiao_atendida: regiaoAtendida,
        possui_logo: hasLogo, cores_preferidas: preferredColors, estilo: desiredStyle,
        servicos: selectedServices, servico_outro: servicoOutro,
        aeroportos, rotas_principais: rotas,
        veiculos, amenidades_veiculos: amenidades,
        diferenciais, diferencial_principal: diferencialPrincipal,
        publico_alvo: publicoAlvo, faixa_preco: faixaPreco,
        pagamentos, formas_reserva: formasReserva,
        redes_sociais: { instagram, facebook, google_business: googleBusiness, tripadvisor: tripAdvisor },
        idiomas, paginas_site: paginas, palavras_chave_seo: palavrasChave, integracoes,
        conteudo: { fotos_cidade: temFotosCidade, fotos_veiculos: temFotosVeiculos, fotos_motorista: temFotosMotorista, videos: temVideos },
        plataformas, horario_atendimento: horarioAtendimento, depoimentos,
      },
    } as any) as any);
    setSubmitting(false);
    if (error) { toast.error("Erro ao enviar: " + error.message); return; }
    toast.success("Briefing enviado com sucesso! O administrador irá processar seu pedido.");
    setBs(1); setStep("gallery");
  };

  // ── Active service view ────────────────────────────
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
          {servicoAtivo.instrucoes_acesso && <div className="space-y-1"><p className="text-sm text-muted-foreground">Instruções de Acesso</p><p className="text-foreground whitespace-pre-wrap">{servicoAtivo.instrucoes_acesso}</p></div>}
          {servicoAtivo.como_usar && <div className="space-y-1"><p className="text-sm text-muted-foreground">Como Usar</p><p className="text-foreground whitespace-pre-wrap">{servicoAtivo.como_usar}</p></div>}
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

  const pendingBanner = servicoAtivo && (servicoAtivo.status === "pendente" || servicoAtivo.status === "em_andamento") ? (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-center gap-3">
      <Info className="h-5 w-5 text-yellow-600" />
      <div>
        <p className="text-sm font-semibold text-foreground">Solicitação em análise</p>
        <p className="text-xs text-muted-foreground">Status: <Badge variant="outline">{servicoAtivo.status === "pendente" ? "Pendente" : "Em andamento"}</Badge></p>
      </div>
    </div>
  ) : null;

  // ── Briefing view ──────────────────────────────────
  if (step === "briefing") {
    return (
      <>
        <UpgradePlanDialog
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          requiredPlan="rise"
          selfServiceUpgrade={plano === "free"}
          onUpgradeSuccess={() => void refetchPlano()}
        />
        {pendingBanner}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Website — Briefing Completo</h1>
            <p className="text-sm text-muted-foreground">
              Modelo: <span className="font-semibold text-foreground">{selectedTemplateName}</span>{" "}
              <button onClick={() => setStep("gallery")} className="text-primary hover:underline">(alterar)</button>
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

          {/* ── STEP 1: Domínio (layout = E-mail Business) + Marca ── */}
          {bs === 1 && (
            <div className="rounded-xl border border-border bg-card p-8 space-y-0">
              <DomainSelectionCard
                domainOption={domainOption}
                onDomainOptionChange={setDomainOption}
                domain={domain}
                onDomainChange={setDomain}
                domainChecked={domainChecked}
                domainAvailable={domainAvailable}
                domainMessage={domainMessage}
                checkingDomain={checkingDomain}
                onCheckDomain={handleCheckDomain}
                onResetCheck={resetDomainCheck}
                extraBelowDomain={
                  domainOption === "existing" ? (
                    <div>
                      <label className="text-sm font-medium text-foreground">Provedor atual</label>
                      <Input
                        value={provider}
                        onChange={(e) => setProvider(e.target.value)}
                        placeholder="Hostinger, GoDaddy, Registro.br, etc."
                        className="mt-1"
                      />
                    </div>
                  ) : undefined
                }
              />
              <div className="mt-10 pt-8 border-t border-border space-y-4">
                <h2 className="text-lg font-bold text-foreground">Marca</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Possui logotipo?</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Checkbox checked={hasLogo} onCheckedChange={(v) => setHasLogo(!!v)} />
                      <span className="text-sm text-foreground">Sim, já possuo</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Cores da marca</label>
                    <Input
                      value={preferredColors}
                      onChange={(e) => setPreferredColors(e.target.value)}
                      placeholder="Preto e dourado, azul marinho..."
                      className="mt-1"
                    />
                  </div>
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
          )}

          {/* ── STEP 2: Empresa ── */}
          {bs === 2 && (
            <Section title="🏢 Informações da Empresa">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-foreground">Nome da empresa *</label><Input value={companyName} onChange={e => setCompanyName(e.target.value)} className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">Nome do responsável</label><Input value={responsavel} onChange={e => setResponsavel(e.target.value)} className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">WhatsApp principal *</label><Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(47) 99999-9999" className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">Telefone secundário</label><Input value={telefoneSecundario} onChange={e => setTelefoneSecundario(e.target.value)} className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">E-mail profissional *</label><Input value={email} onChange={e => setEmail(e.target.value)} className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">CNPJ (opcional)</label><Input value={cnpj} onChange={e => setCnpj(e.target.value)} className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">Cidade sede *</label><Input value={cidadeSede} onChange={e => setCidadeSede(e.target.value)} className="mt-1" /></div>
                <div><label className="text-sm font-medium text-foreground">Região atendida *</label><Input value={regiaoAtendida} onChange={e => setRegiaoAtendida(e.target.value)} placeholder="Ex: Balneário Camboriú, Itajaí, Navegantes..." className="mt-1" /></div>
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
              <div>
                <label className="text-sm font-medium text-foreground">Descreva seus veículos</label>
                <Textarea value={veiculos} onChange={e => setVeiculos(e.target.value)} placeholder="Toyota Corolla 2024 — 4 passageiros, 3 malas&#10;Spin 2023 — 6 passageiros, 5 malas" rows={5} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Informe modelo, ano, capacidade de passageiros e malas de cada veículo.</p>
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
                  ["E-mail", email || "—"],
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
              if (bs === 1) setStep("gallery"); else setBs(s => s - 1);
            }}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <span className="text-xs text-muted-foreground">{bs} de {STEPS.length}</span>
            <Button onClick={() => {
              if (bs === 1) {
                if (!canAdvanceFromDomainSelection(domain, domainOption, domainChecked, domainAvailable)) {
                  if (domainOption === "new" && !domainChecked) {
                    toast.error("Pesquise a disponibilidade do domínio antes de continuar.");
                  } else if (domainOption === "new" && domainAvailable === false) {
                    toast.error("Domínio indisponível. Escolha outro domínio.");
                  } else {
                    toast.error("Informe um domínio válido.");
                  }
                  return;
                }
                if (plano === "free") {
                  setUpgradeOpen(true);
                  return;
                }
              }
              if (bs === 2) {
                if (!companyName.trim()) { toast.error("Preencha o nome da empresa."); return; }
                if (!whatsapp.trim()) { toast.error("Preencha o WhatsApp."); return; }
                if (!email.trim()) { toast.error("Preencha o e-mail."); return; }
                if (!cidadeSede.trim()) { toast.error("Preencha a cidade sede."); return; }
                if (!regiaoAtendida.trim()) { toast.error("Preencha a região atendida."); return; }
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
      {pendingBanner}
      <SlideCarousel pagina="website" fallbackSlides={[
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
              <div className={cn("rounded-xl h-48 relative overflow-hidden border bg-muted group cursor-pointer", isSelected ? "ring-2 ring-primary" : "border-border")} onClick={() => setSelectedTemplate(t.id)}>
                {t.imagem_url ? (
                  <img src={t.imagem_url} alt={t.nome} className="w-full object-cover object-top transition-transform duration-[60s] ease-linear group-hover:translate-y-[calc(-100%+12rem)]" style={{ minHeight: "200%" }} />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">Sem imagem</div>
                )}
                {isSelected && <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center z-10"><Check className="h-3.5 w-3.5" /></div>}
              </div>
              <p className="font-semibold text-foreground mt-3 text-sm">{t.nome}</p>
              {t.link_modelo && <a href={t.link_modelo} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm" className="mt-2 w-full gap-2"><Eye className="h-4 w-4" /> Ver Modelo</Button></a>}
              {isSelected ? (
                <Button size="sm" className="mt-2 w-full gap-2"><Check className="h-4 w-4" /> Selecionado</Button>
              ) : (
                <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setSelectedTemplate(t.id)}>Selecionar</Button>
              )}
            </div>
          );
        })}
      </div>
      {dbTemplates.length === 0 && <div className="text-center py-12 text-muted-foreground">Nenhum template disponível no momento.</div>}
      {selectedTemplate && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button onClick={() => { setStep("briefing"); setBs(1); }} className="gap-2 shadow-lg px-6">
            <Monitor className="h-4 w-4" /> Continuar com este modelo <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      <UpgradePlanDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        requiredPlan="rise"
        selfServiceUpgrade={plano === "free"}
        onUpgradeSuccess={() => void refetchPlano()}
      />
    </div>
  );
}
