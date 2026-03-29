import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Star, User, CheckCircle2, Mail, Minus, Plus,
  ArrowLeft, ArrowRight, Sparkles, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExternalLink, Calendar, Info } from "lucide-react";
import SlideCarousel from "@/components/SlideCarousel";
import {
  DomainSelectionCard,
  canAdvanceFromDomainSelection,
} from "@/components/domain/DomainSelectionCard";
import { useUserPlan } from "@/hooks/useUserPlan";
import UpgradePlanDialog from "@/components/planos/UpgradePlanDialog";

const benefits = [
  "Mais autoridade no WhatsApp",
  "Mais confiança para hotéis e empresas",
  "Evita cair no spam",
  "Passa imagem de empresa estruturada",
  "Integração com Google Business",
];

const plans = [
  { name: "Email Go 30 GB", storage: "30 GB por conta", unitPrice: 13.41, defaultAccounts: 2, recommended: false },
  { name: "Email Go 50 GB", storage: "50 GB por conta", unitPrice: 17.91, defaultAccounts: 2, recommended: true },
  { name: "Email Locaweb 15 GB", storage: "15 GB por conta", unitPrice: 6.21, defaultAccounts: 25, recommended: false },
];

const STEPS = ["Domínio", "Plano", "Dados", "Confirmação"] as const;

function fmt(v: number) {
  return v.toFixed(2).replace(".", ",");
}

export default function EmailBusinessPage() {
  const [submitting, setSubmitting] = useState(false);
  const [servicoAtivo, setServicoAtivo] = useState<any>(null);
  const { plano } = useUserPlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // wizard state
  const [wizardActive, setWizardActive] = useState(false);
  const [step, setStep] = useState(0);

  // step 1 – domain
  const [domainOption, setDomainOption] = useState<"new" | "existing">("new");
  const [domain, setDomain] = useState("");
  const [domainChecked, setDomainChecked] = useState(false);
  const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null);
  const [checkingDomain, setCheckingDomain] = useState(false);
  const [domainMessage, setDomainMessage] = useState("");

  // step 2 – plan
  const [selectedPlan, setSelectedPlan] = useState(1);
  const [accounts, setAccounts] = useState(plans.map((p) => p.defaultAccounts));

  // step 3 – data
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [emailPrefix, setEmailPrefix] = useState("contato");

  const plan = plans[selectedPlan];
  const totalMensal = plan.unitPrice * accounts[selectedPlan];
  const totalAnual = totalMensal * 12;
  const emailPrincipal = `${emailPrefix}@${domain || "seudominio"}`;

  const resetDomainCheck = () => {
    setDomainChecked(false);
    setDomainAvailable(null);
    setDomainMessage("");
  };

  const handleCheckDomain = async () => {
    if (!domain.trim() || !domain.includes(".")) {
      toast.error("Informe um domínio válido (ex: suaempresa.com.br)");
      return;
    }
    setCheckingDomain(true);
    setDomainChecked(false);
    setDomainAvailable(null);
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
    } catch (err: any) {
      toast.error("Erro ao verificar domínio: " + (err.message || ""));
    } finally {
      setCheckingDomain(false);
    }
  };

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
        tipo_dominio: domainOption,
        plano: plan.name,
        contas: accounts[selectedPlan],
        valor_mensal: totalMensal,
        valor_anual: totalAnual,
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
          <Button size="lg" onClick={() => setWizardActive(true)}>
            Contratar E-mail Business <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  /* ── Wizard ── */
  return (
    <div className="space-y-8">
      <UpgradePlanDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} requiredPlan="seed" />
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

      {/* Step content */}
      <div className="rounded-xl border border-border bg-card p-8">
        {/* STEP 1 – Domínio */}
        {step === 0 && (
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
          />
        )}

        {/* STEP 2 – Plano */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Star className="h-5 w-5" /> Confirme seu plano
            </h2>

            <div className="space-y-4">
              {plans.map((p, idx) => (
                <div
                  key={p.name}
                  onClick={() => setSelectedPlan(idx)}
                  className={`rounded-xl border p-5 cursor-pointer transition-all ${
                    selectedPlan === idx
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {idx === 2 ? (
                        <User className="h-5 w-5 text-muted-foreground" />
                      ) : idx === 1 ? (
                        <Star className="h-5 w-5 text-primary" />
                      ) : (
                        <Mail className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-semibold text-foreground">{p.name}</p>
                        <p className="text-sm text-muted-foreground">{p.storage}</p>
                      </div>
                    </div>
                    {p.recommended && (
                      <Badge className="bg-primary text-primary-foreground">Recomendado</Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Contas:</span>
                      <div className="flex items-center border border-border rounded-lg ml-2">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); setAccounts(prev => { const n = [...prev]; n[idx] = Math.max(1, n[idx] - 1); return n; }); }}
                        ><Minus className="h-3 w-3" /></Button>
                        <span className="w-8 text-center text-sm font-medium text-foreground">{accounts[idx]}</span>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); setAccounts(prev => { const n = [...prev]; n[idx] = n[idx] + 1; return n; }); }}
                        ><Plus className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm text-muted-foreground">{accounts[idx]}x R$ {fmt(p.unitPrice)}</span>
                    <span className="font-bold text-foreground">R$ {fmt(p.unitPrice * accounts[idx])}/mês</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3 – Dados */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <User className="h-5 w-5" /> Seus dados
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Nome completo</label>
                <Input placeholder="Felipe da Silva" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">Nome da empresa</label>
                <Input placeholder="Executivo Balneário" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-1">Nome do e-mail principal</label>
              <div className="flex items-center gap-2">
                <Input
                  className="max-w-[200px]"
                  value={emailPrefix}
                  onChange={(e) => setEmailPrefix(e.target.value)}
                />
                <span className="text-sm text-muted-foreground">@{domain || "seudominio"}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Sugestões: contato, reservas, financeiro</p>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
              <p className="text-sm text-muted-foreground">E-mail principal:</p>
              <p className="text-lg font-bold text-foreground mt-1">{emailPrincipal}</p>
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
              <div className="flex justify-between py-3">
                <span className="text-sm text-muted-foreground">Domínio</span>
                <span className="text-sm font-medium text-foreground">{domain || "—"}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-sm text-muted-foreground">Plano</span>
                <span className="text-sm font-medium text-foreground">{plan.name}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-sm text-muted-foreground">Contas de e-mail</span>
                <span className="text-sm font-medium text-foreground">{accounts[selectedPlan]} contas</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-sm text-muted-foreground">Valor mensal</span>
                <span className="text-sm font-medium text-foreground">R$ {fmt(totalMensal)}/mês</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-sm text-muted-foreground">Valor anual</span>
                <span className="text-sm font-bold text-primary">R$ {fmt(totalAnual)}/ano</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-sm text-muted-foreground">E-mail principal</span>
                <span className="text-sm font-medium text-foreground">{emailPrincipal}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-sm text-muted-foreground">Responsável</span>
                <span className="text-sm font-medium text-foreground">{nomeCompleto || "—"}</span>
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
              if (step === 0) setWizardActive(false);
              else setStep((s) => s - 1);
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => {
                if (step === 0) {
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
                if (step === 2) {
                  if (!nomeCompleto.trim()) { toast.error("Preencha o nome completo."); return; }
                  if (!nomeEmpresa.trim()) { toast.error("Preencha o nome da empresa."); return; }
                  if (!emailPrefix.trim()) { toast.error("Preencha o nome do e-mail principal."); return; }
                }
                setStep((s) => s + 1);
              }}
              variant={
                step === 0 && !canAdvanceFromDomainSelection(domain, domainOption, domainChecked, domainAvailable)
                  ? "outline"
                  : "default"
              }
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
    </div>
  );
}
