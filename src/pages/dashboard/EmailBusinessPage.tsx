import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  User, CheckCircle2, Mail,
  ArrowLeft, ArrowRight, Sparkles, FileText,
  ExternalLink, Calendar, Info, Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SlideCarousel from "@/components/SlideCarousel";
import { PurchasedDomainSelectStep } from "@/components/domain/PurchasedDomainSelectStep";
import { usePurchasedDomains } from "@/hooks/usePurchasedDomains";
import { useActivePage } from "@/contexts/ActivePageContext";
import { useUserPlan } from "@/hooks/useUserPlan";
import UpgradePlanDialog from "@/components/planos/UpgradePlanDialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

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

function emailBusinessStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pendente: "Em análise",
    em_andamento: "Em andamento",
    concluido: "Ativo",
    publicado: "Publicado",
    recusado: "Recusado",
  };
  return map[status] ?? status;
}

function emailBusinessStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    pendente: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
    em_andamento: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    concluido: "bg-green-500/10 text-green-700 border-green-500/30",
    publicado: "bg-emerald-500/10 text-emerald-800 border-emerald-500/30",
    recusado: "bg-red-500/10 text-red-700 border-red-500/30",
  };
  return map[status] ?? "bg-muted text-muted-foreground border-border";
}

function EmailBusinessBillingNotice() {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 max-w-3xl mx-auto">
      <p className="text-sm text-foreground flex items-start gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
        <span>
          O primeiro e-mail é gratuito. Novas caixas de e-mail possuem o custo de{" "}
          <strong>R$ 14,99/mês</strong> por unidade.
        </span>
      </p>
    </div>
  );
}

function parseEmailRowDados(dados: unknown): {
  email: string;
  dominio: string;
  empresa: string;
  responsavel: string;
} {
  const ds = dados as Record<string, unknown> | null;
  const str = (k: string) => (typeof ds?.[k] === "string" ? (ds[k] as string) : "");
  return {
    email: str("email_principal").trim() || "—",
    dominio: str("dominio").trim() || "—",
    empresa: str("nome_empresa").trim() || "—",
    responsavel: str("nome_completo").trim() || "—",
  };
}

export default function EmailBusinessPage() {
  const { setActivePage } = useActivePage();
  const [submitting, setSubmitting] = useState(false);
  const [emailSolicitacoes, setEmailSolicitacoes] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const { plano, refetch: refetchPlano } = useUserPlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // wizard state
  const [wizardActive, setWizardActive] = useState(false);
  /** first = primeiro e-mail gratuito; additional = caixa extra (plano pago + cobrança mensal) */
  const [wizardMode, setWizardMode] = useState<"first" | "additional" | null>(null);
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

  const fetchEmailSolicitacoes = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setEmailSolicitacoes([]);
      setListLoading(false);
      return;
    }
    setListLoading(true);
    const { data, error } = await (supabase
      .from("solicitacoes_servicos" as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("tipo_servico", "email")
      .order("created_at", { ascending: false }) as any);
    if (error) {
      toast.error("Erro ao carregar solicitações de e-mail");
      setEmailSolicitacoes([]);
    } else {
      setEmailSolicitacoes(data || []);
    }
    setListLoading(false);
  }, []);

  useEffect(() => {
    void fetchEmailSolicitacoes();
  }, [fetchEmailSolicitacoes]);

  const hasPendingReview = emailSolicitacoes.some(
    (s) => s.status === "pendente" || s.status === "em_andamento",
  );

  const pendingBanner = hasPendingReview ? (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-center gap-3 mb-6">
      <Info className="h-5 w-5 text-yellow-600" />
      <div>
        <p className="text-sm font-semibold text-foreground">Solicitação(ões) em análise</p>
        <p className="text-xs text-muted-foreground">
          Acompanhe o status de cada e-mail na tabela abaixo.
        </p>
      </div>
    </div>
  ) : null;

  const resetWizardFields = () => {
    setDomainPickSelect("");
    setPurchasedDomainId(null);
    setDomain("");
    setEmailPrefix("");
    setNomeCompleto("");
    setNomeEmpresa("");
    setStep(0);
  };

  const handleSubmitEmail = async () => {
    const isFirstFree = wizardMode === "first";
    if (!isFirstFree && plano === "free") {
      setUpgradeOpen(true);
      toast.message("Plano necessário", {
        description: "Para solicitar caixas adicionais de e-mail, confirme um plano pago no painel.",
      });
      return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não autenticado"); setSubmitting(false); return; }

    const cobranca = isFirstFree
      ? { tipo: "primeiro_gratuito" as const, valor_mensal_reais: 0 }
      : { tipo: "adicional_mensal" as const, valor_mensal_reais: 14.99 };

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
        cobranca_email_business: cobranca,
      },
    } as any) as any);
    setSubmitting(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Solicitação de e-mail enviada com sucesso!");
    setWizardActive(false);
    setWizardMode(null);
    void fetchEmailSolicitacoes();
  };

  const goToDomainMenu = () => setActivePage("dominios");

  const openWizardFirst = () => {
    resetWizardFields();
    setWizardMode("first");
    setWizardActive(true);
  };

  const openWizardAdditional = () => {
    resetWizardFields();
    setWizardMode("additional");
    setWizardActive(true);
  };

  const closeWizard = () => {
    setWizardActive(false);
    setStep(0);
    setWizardMode(null);
  };

  /* ── Landing Page ── */
  if (!wizardActive) {
    return (
      <div className="space-y-8">
        <SlideCarousel
          pagina="email_business"
          breakoutTop
          fallbackSlides={[
            { titulo: "Seu E-mail Profissional", subtitulo: "Tenha um endereço como contato@suaempresa.com.br e transmita autoridade e credibilidade para hotéis e clientes executivos." },
            { titulo: "Destaque-se da Concorrência", subtitulo: "Um e-mail profissional mostra que você leva seu negócio a sério. Impressione clientes corporativos e feche mais contratos." },
            { titulo: "Integração Total", subtitulo: "Sincronize com Google Business, WhatsApp Business e todas as ferramentas do E-Transporte.pro automaticamente." },
          ]}
        />

        <EmailBusinessBillingNotice />

        {pendingBanner}

        {listLoading ? (
          <p className="text-center text-sm text-muted-foreground py-12">Carregando…</p>
        ) : emailSolicitacoes.length > 0 ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <Mail className="h-6 w-6 text-primary" /> Seus e-mails Business
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Todas as caixas solicitadas e o status de cada uma.
                </p>
              </div>
              <Button size="lg" onClick={openWizardAdditional} className="shrink-0">
                <Plus className="h-4 w-4 mr-2" /> Criar novo e-mail
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead className="hidden md:table-cell">Domínio</TableHead>
                    <TableHead className="hidden lg:table-cell">Empresa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Solicitado em</TableHead>
                    <TableHead className="text-right w-[100px]">Acesso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailSolicitacoes.map((row) => {
                    const { email, dominio, empresa } = parseEmailRowDados(row.dados_solicitacao);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium break-all">{email}</TableCell>
                        <TableCell className="hidden md:table-cell break-all text-muted-foreground">{dominio}</TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">{empresa}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={emailBusinessStatusBadgeClass(row.status)}>
                            {emailBusinessStatusLabel(row.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground whitespace-nowrap">
                          {new Date(row.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.link_acesso ? (
                            <a
                              href={row.link_acesso}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary text-sm font-medium hover:underline"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Abrir
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {(() => {
              const detailRows = emailSolicitacoes.filter(
                (r) =>
                  (r.status === "concluido" || r.status === "publicado") &&
                  !!(r.data_expiracao || r.instrucoes_acesso || r.como_usar || r.link_acesso),
              );
              if (!detailRows.length) return null;
              return (
                <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" /> Detalhes dos serviços ativos
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Informações extras preenchidas pela equipe para solicitações já concluídas.
                  </p>
                  <div className="space-y-6">
                    {detailRows.map((row) => {
                      const { email } = parseEmailRowDados(row.dados_solicitacao);
                      return (
                        <div key={`detail-${row.id}`} className="rounded-lg border border-border p-4 space-y-3">
                          <p className="text-sm font-medium text-foreground break-all">{email}</p>
                          {row.link_acesso && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Link de acesso</p>
                              <a href={row.link_acesso} target="_blank" rel="noopener noreferrer" className="text-primary text-sm flex items-center gap-1 hover:underline break-all">
                                <ExternalLink className="h-4 w-4 shrink-0" /> {row.link_acesso}
                              </a>
                            </div>
                          )}
                          {row.data_expiracao && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Válido até</p>
                              <p className="text-sm flex items-center gap-1"><Calendar className="h-4 w-4" /> {new Date(row.data_expiracao).toLocaleDateString("pt-BR")}</p>
                            </div>
                          )}
                          {row.instrucoes_acesso && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Instruções</p>
                              <p className="text-sm whitespace-pre-wrap">{row.instrucoes_acesso}</p>
                            </div>
                          )}
                          {row.como_usar && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Como usar</p>
                              <p className="text-sm whitespace-pre-wrap">{row.como_usar}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <>
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
              <Button size="lg" onClick={openWizardFirst}>
                Contratar E-mail Business <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  /* ── Wizard ── */
  const isAdditionalWizard = wizardMode === "additional";

  return (
    <div className="space-y-8">
      <UpgradePlanDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        requiredPlan="seed"
        selfServiceUpgrade={plano === "free"}
        onUpgradeSuccess={() => void refetchPlano()}
      />
      {isAdditionalWizard && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm text-foreground">
            <strong>Nova caixa:</strong> após a criação, esta caixa adicional terá custo de{" "}
            <strong>R$ 14,99/mês</strong> por unidade.
          </p>
        </div>
      )}
      {pendingBanner}
      {/* Stepper */}
      <div className="flex items-center justify-center gap-0 flex-wrap">
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
                setStep(1);
              }
            }}
            onRegisterNew={goToDomainMenu}
          />
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={closeWizard}
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <Button
              onClick={() => {
                if (!domainPickSelect || !domain.trim()) {
                  toast.error("Selecione um domínio já cadastrado ou registre um novo no menu Domínios.");
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
              <Mail className="h-5 w-5" /> Digite o e-mail desejado
            </h2>

            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Domínio</p>
              <p className="font-mono text-sm font-semibold text-foreground break-all mt-1">{domain || "—"}</p>
            </div>

            <div>
              <label htmlFor="email-prefix-local" className="text-sm font-medium text-foreground block mb-2">
                Endereço completo
              </label>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-lg border border-border bg-background px-3 py-2">
                <Input
                  id="email-prefix-local"
                  className="min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-9 sm:max-w-none max-w-[200px]"
                  placeholder="contato"
                  value={emailPrefix}
                  onChange={(e) => setEmailPrefix(sanitizeEmailLocalPart(e.target.value))}
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="text-sm text-muted-foreground select-none shrink-0">@{domain || ""}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Informe apenas a parte antes do @. O domínio vem da etapa anterior.
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

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-2">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" /> Próximos passos
              </p>
              {isAdditionalWizard ? (
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Sua solicitação será analisada pela equipe.</li>
                  <li>
                    Esta caixa adicional tem custo de <strong className="text-foreground">R$ 14,99/mês</strong> por unidade após a ativação.
                  </li>
                  <li>Após a liberação, os dados de acesso aparecerão na listagem desta página.</li>
                </ol>
              ) : (
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Sua solicitação será analisada pela equipe.</li>
                  <li>Você acompanha o status na listagem desta página.</li>
                  <li>Após a liberação, os dados de acesso aparecerão aqui.</li>
                </ol>
              )}
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
