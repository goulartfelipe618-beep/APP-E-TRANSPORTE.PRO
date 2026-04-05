import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  User, CheckCircle2, Mail,
  ArrowLeft, ArrowRight, Sparkles, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExternalLink, Calendar, Info } from "lucide-react";
import SlideCarousel from "@/components/SlideCarousel";
import { PurchasedDomainSelectStep } from "@/components/domain/PurchasedDomainSelectStep";
import { usePurchasedDomains } from "@/hooks/usePurchasedDomains";
import { useActivePage } from "@/contexts/ActivePageContext";
import { useUserPlan } from "@/hooks/useUserPlan";
import UpgradePlanDialog from "@/components/planos/UpgradePlanDialog";

const benefits = [
  "Mais autoridade no WhatsApp",
  "Mais confiança para hotéis e empresas",
  "Evita cair no spam",
  "Passa imagem de empresa estruturada",
  "Integração com Google Business",
];

const STEPS = ["Domínio", "E-mail", "Dados", "Confirmação"] as const;

/** Caracteres permitidos na parte local do e-mail (RFC simplificado). */
function sanitizeEmailLocalPart(raw: string) {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._+-]/g, "");
}

export default function EmailBusinessPage() {
  const { setActivePage } = useActivePage();
  const [submitting, setSubmitting] = useState(false);
  const [servicoAtivo, setServicoAtivo] = useState<any>(null);
  const { plano, refetch: refetchPlano } = useUserPlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // wizard state
  const [wizardActive, setWizardActive] = useState(false);
  const [step, setStep] = useState(0);

  // step 0 – domínio (igual ao Website: lista de domínios comprados)
  const [domain, setDomain] = useState("");
  const [purchasedDomainId, setPurchasedDomainId] = useState<string | null>(null);
  const [domainPickSelect, setDomainPickSelect] = useState("");
  const domainStepEnabled = wizardActive && step === 0;
  const { domains: purchasedDomains, loading: domainPickLoading } = usePurchasedDomains(domainStepEnabled);

  // step 1 – nome antes do @ (domínio vem do passo 0)
  const [emailPrefix, setEmailPrefix] = useState("");

  // step 2 – dados pessoais / empresa
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [nomeEmpresa, setNomeEmpresa] = useState("");

  const emailPrincipal =
    emailPrefix.trim() && domain.trim() ? `${sanitizeEmailLocalPart(emailPrefix.trim())}@${domain.trim()}` : "";

  useEffect(() => {
    const checkServico = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase.from("solicitacoes_servicos" as any).select("*").eq("user_id", user.id).eq("tipo_servico", "email").order("created_at", { ascending: false }).limit(1) as any);
      if (data && data.length > 0) {
        setServicoAtivo(data[0]);
      }
    };
    checkServico();
  }, []);

  const handleSubmitEmail = async () => {
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não autenticado"); setSubmitting(false); return; }
    const { error } = await (supabase.from("solicitacoes_servicos" as any).insert({
      user_id: user.id,
      tipo_servico: "email",
      dados_solicitacao: {
        dominio: domain,
        dominio_usuario_id: purchasedDomainId,
        tipo_dominio: "existing",
        email_prefix: sanitizeEmailLocalPart(emailPrefix.trim()),
        email_principal: emailPrincipal,
        nome_completo: nomeCompleto,
        nome_empresa: nomeEmpresa,
      },
    } as any) as any);
    setSubmitting(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Solicitação de e-mail enviada com sucesso!");
    setWizardActive(false);
  };

  // Active service view
  if (servicoAtivo?.status === "concluido") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-primary" /> E-mail Business — Serviço Ativo
          </h1>
          <p className="text-muted-foreground">Seu e-mail profissional está configurado.</p>
        </div>
        <div className="rounded-xl border border-primary/30 bg-card p-6 space-y-4">
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
      </div>
    );
  }

  const pendingBanner = servicoAtivo && (servicoAtivo.status === "pendente" || servicoAtivo.status === "em_andamento") ? (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-center gap-3 mb-6">
      <Info className="h-5 w-5 text-yellow-600" />
      <div>
        <p className="text-sm font-semibold text-foreground">Solicitação em análise</p>
        <p className="text-xs text-muted-foreground">Status: <Badge variant="outline">{servicoAtivo.status === "pendente" ? "Pendente" : "Em andamento"}</Badge></p>
      </div>
    </div>
  ) : null;

  /* ── Landing Page ── */
  if (!wizardActive) {
    return (
      <div className="space-y-8">
        {pendingBanner}
        {/* Carousel */}
        <SlideCarousel
          pagina="email_business"
          fallbackSlides={[
            { titulo: "Seu E-mail Profissional", subtitulo: "Tenha um endereço como contato@suaempresa.com.br e transmita autoridade e credibilidade para hotéis e clientes executivos." },
            { titulo: "Destaque-se da Concorrência", subtitulo: "Um e-mail profissional mostra que você leva seu negócio a sério. Impressione clientes corporativos e feche mais contratos." },
            { titulo: "Integração Total", subtitulo: "Sincronize com Google Business, WhatsApp Business e todas as ferramentas do E-Transporte.pro automaticamente." },
          ]}
        />

        <div className="text-center space-y-3">
          <Badge variant="outline" className="gap-2 px-4 py-1.5"><Mail className="h-4 w-4" /> E-mail Business</Badge>
          <h2 className="text-2xl font-bold text-foreground">Seu e-mail profissional para fechar mais corridas</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">Pare de usar Gmail comum. Tenha um e-mail com o nome da sua empresa e passe autoridade para hotéis, empresas e clientes executivos.</p>
        </div>

        <div className="flex justify-center">
          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 px-10 py-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Exemplo:</p>
            <p className="text-lg font-bold text-foreground">contato@transporteexecutivo.com.br</p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
          {benefits.map((b) => (<div key={b} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /><span className="text-sm text-foreground">{b}</span></div>))}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 max-w-3xl mx-auto">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">Pare de parecer amador</p>
              <p className="text-sm text-muted-foreground mt-1">Motoristas que usam Gmail comum passam menos confiança para hotéis, empresas e executivos. Com um e-mail profissional você mostra que seu serviço é empresa, não bico.</p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Button
            size="lg"
            onClick={() => {
              setDomainPickSelect("");
              setPurchasedDomainId(null);
              setDomain("");
              setEmailPrefix("");
              setNomeCompleto("");
              setNomeEmpresa("");
              setWizardActive(true);
            }}
          >
            Contratar E-mail Business <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  const goToDomainMenu = () => setActivePage("dominios");

  /* ── Wizard ── */
  return (
    <div className="space-y-8">
      <UpgradePlanDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        requiredPlan="seed"
        selfServiceUpgrade={plano === "free"}
        onUpgradeSuccess={() => void refetchPlano()}
      />
      {pendingBanner}
      {/* Stepper */}
      <div className="flex items-center justify-center gap-0">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i + 1}
              </div>
              <span className={`text-sm ${i <= step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-20 h-0.5 mx-3 ${i < step ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      {step === 0 ? (
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
              }
            }}
            onRegisterNew={goToDomainMenu}
          />
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setWizardActive(false);
                setStep(0);
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <Button
              onClick={() => {
                if (!domainPickSelect || !domain.trim()) {
                  toast.error("Selecione um domínio já cadastrado ou registre um novo no menu Domínios.");
                  return;
                }
                if (plano === "free") {
                  setUpgradeOpen(true);
                  return;
                }
                setStep(1);
              }}
            >
              Próximo <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      ) : (
      <div className="rounded-xl border border-border bg-card p-8">
        {/* STEP 2 – Nome do e-mail (domínio fixo do passo anterior) */}
        {step === 1 && (
          <div className="space-y-6 max-w-xl">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Mail className="h-5 w-5" /> Seu e-mail principal
            </h2>

            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Domínio (fixo)</p>
              <p className="font-mono text-sm font-semibold text-foreground break-all mt-1">{domain || "—"}</p>
            </div>

            <div>
              <label htmlFor="email-prefix-local" className="text-sm font-medium text-foreground block mb-2">
                Nome do e-mail desejado
              </label>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-lg border border-border bg-background px-3 py-2">
                <Input
                  id="email-prefix-local"
                  className="border-0 shadow-none focus-visible:ring-0 max-w-[220px] px-0 h-9"
                  placeholder="contato"
                  value={emailPrefix}
                  onChange={(e) => setEmailPrefix(sanitizeEmailLocalPart(e.target.value))}
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="text-sm text-muted-foreground select-none shrink-0">@{domain || ""}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Apenas o trecho antes do @ pode ser editado. O domínio não pode ser alterado nesta etapa.</p>
            </div>

            <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground leading-relaxed">
              <p>
                Você deseja ter mais de 1 e-mail business? Você terá a oportunidade de comprar novas caixas de e-mail assim
                que registrar o seu e-mail principal.
              </p>
              <p>
                Após o registro deste e-mail, não haverá possibilidade de reverter ou editar o nome do registro de e-mail.
              </p>
            </div>
          </div>
        )}

        {/* STEP 3 – Dados */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <User className="h-5 w-5" /> Seus dados
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Nome completo</label>
                <Input placeholder="Felipe da Silva" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Nome da empresa</label>
                <Input placeholder="Executivo Balneário" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} />
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
              <p className="text-sm text-muted-foreground">E-mail principal</p>
              <p className="text-lg font-bold text-foreground mt-1 break-all">{emailPrincipal || "—"}</p>
            </div>
          </div>
        )}

        {/* STEP 4 – Confirmação */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" /> Confirme sua solicitação
            </h2>

            <div className="divide-y divide-border">
              <div className="flex justify-between gap-4 py-3">
                <span className="text-sm text-muted-foreground shrink-0">Domínio</span>
                <span className="text-sm font-medium text-foreground text-right break-all">{domain || "—"}</span>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <span className="text-sm text-muted-foreground shrink-0">E-mail principal</span>
                <span className="text-sm font-medium text-foreground text-right break-all">{emailPrincipal}</span>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <span className="text-sm text-muted-foreground shrink-0">Empresa</span>
                <span className="text-sm font-medium text-foreground text-right">{nomeEmpresa || "—"}</span>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <span className="text-sm text-muted-foreground shrink-0">Responsável</span>
                <span className="text-sm font-medium text-foreground text-right">{nomeCompleto || "—"}</span>
              </div>
            </div>

            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5 space-y-2">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" /> Próximos passos:
              </p>
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                <li>Sua solicitação será analisada pela equipe</li>
                <li>Entraremos em contato via WhatsApp para pagamento</li>
                <li>Após confirmação, seus e-mails serão criados e ativados</li>
              </ol>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => {
              if (step === 1) setStep(0);
              else setStep((s) => s - 1);
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => {
                if (step === 1) {
                  const local = sanitizeEmailLocalPart(emailPrefix.trim());
                  if (!local.length) {
                    toast.error("Digite o nome do e-mail (parte antes do @).");
                    return;
                  }
                  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
                    toast.error("Nome do e-mail inválido.");
                    return;
                  }
                }
                if (step === 2) {
                  if (!nomeCompleto.trim()) { toast.error("Preencha o nome completo."); return; }
                  if (!nomeEmpresa.trim()) { toast.error("Preencha o nome da empresa."); return; }
                }
                setStep((s) => s + 1);
              }}
            >
              Próximo <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={() => {
              if (!domain.trim() || !nomeCompleto.trim() || !nomeEmpresa.trim() || !emailPrefix.trim()) {
                toast.error("Preencha todos os campos obrigatórios antes de enviar.");
                return;
              }
              handleSubmitEmail();
            }} disabled={submitting}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> {submitting ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
