import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  CreditCard,
  FileText,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import UpgradePlanDialog from "@/components/planos/UpgradePlanDialog";
import { PLAN_COLORS, PLAN_LABELS, useUserPlan, type PlanType } from "@/hooks/useUserPlan";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  BILLING_CYCLE_LABELS,
  formatBrlParts,
  getBillingCycleDisplay,
  type BillingCycle,
} from "@/lib/billingCycles";

type PaidPlan = Extract<PlanType, "standart" | "pro">;

type PlanContractConfig = {
  titulo: string;
  versao: string;
  conteudo: string;
  vigencia_inicio: string | null;
  updated_at: string;
};

type PlanCardInfo = {
  tier: PlanType;
  headline: string;
  description: string;
  bestFor: string;
  included: string[];
  restrictions: string[];
};

const PAID_CYCLE: BillingCycle = "monthly";

const PLAN_CARDS: PlanCardInfo[] = [
  {
    tier: "free",
    headline: "Comece com organização",
    description: "Entrada na plataforma com dados preservados e limites claros para validar a operação.",
    bestFor: "Primeiros testes, estruturação da frota e uso inicial.",
    included: [
      "Painel, financeiro, clientes, veículos e configurações essenciais",
      "Reservas Transfer e Grupos com limite operacional",
      "Motoristas, receptivos, QR Codes, suporte e anotações",
    ],
    restrictions: [
      "Até 3 reservas por dia em Transfer e Grupos",
      "Até 3 cadastros de motoristas",
      "Até 3 links de geolocalização por mês",
      "Contratos, campanhas e recursos premium ficam bloqueados",
    ],
  },
  {
    tier: "standart",
    headline: "Operação profissional",
    description: "Remove limites do FREE e libera contratos e campanhas para rodar a operação com mais escala.",
    bestFor: "Frotas que já vendem e precisam formalizar, organizar e captar mais.",
    included: [
      "Tudo do FREE com reservas, motoristas e geolocalização sem os limites iniciais",
      "Contratos Transfer e Grupos para PDF e confirmação",
      "Campanhas Ativos e Leads para marketing e captação",
      "Fluxo comercial com dados preservados e acesso por conta",
    ],
    restrictions: [
      "Mini painel do motorista exige PRÓ",
      "Website, domínios e e-mail business exigem PRÓ",
      "Automações avançadas e integrações premium exigem PRÓ",
    ],
  },
  {
    tier: "pro",
    headline: "Suite completa",
    description: "Plano máximo da plataforma: libera o ecossistema completo para marca, motorista e automações.",
    bestFor: "Operações que querem escala, presença digital e experiência premium.",
    included: [
      "Tudo do STANDART, sem restrições de plano",
      "Solicitações Transfer, Grupos e Motoristas",
      "Mini painel do motorista com link seguro",
      "Website, domínios, e-mail business e presença digital",
      "Automações avançadas, integrações premium e prioridade nas novidades",
    ],
    restrictions: [],
  },
];

const ACCESS_ROWS: Array<{
  area: string;
  free: string;
  standart: string;
  pro: string;
}> = [
  {
    area: "Reservas e operação",
    free: "Limites diários",
    standart: "Sem limites FREE",
    pro: "Completo",
  },
  {
    area: "Contratos",
    free: "Bloqueado",
    standart: "Transfer e Grupos",
    pro: "Transfer e Grupos",
  },
  {
    area: "Campanhas",
    free: "Bloqueado",
    standart: "Ativos e Leads",
    pro: "Ativos e Leads",
  },
  {
    area: "Solicitações",
    free: "Básico",
    standart: "Parcial",
    pro: "Transfer, Grupos e Motoristas",
  },
  {
    area: "Motorista",
    free: "Cadastros limitados",
    standart: "Cadastros liberados",
    pro: "Cadastros + mini painel",
  },
  {
    area: "Presença digital",
    free: "Não incluso",
    standart: "Não incluso",
    pro: "Website, domínios e e-mail",
  },
  {
    area: "Automações",
    free: "Básico",
    standart: "Essencial",
    pro: "Avançado + integrações",
  },
];

const DEFAULT_PLAN_CONTRACT: PlanContractConfig = {
  titulo: "Contrato de Assinatura dos Planos E-Transporte.pro",
  versao: "1.0",
  vigencia_inicio: null,
  updated_at: new Date().toISOString(),
  conteudo:
    "O contrato dos planos ainda não foi configurado pelo Admin Master. Assim que for publicado, ficará disponível aqui para consulta dentro do seu painel.",
};

function monthlyPriceLabel(tier: PaidPlan) {
  const display = getBillingCycleDisplay(PAID_CYCLE);
  const value = tier === "standart" ? display.standartPerMonth : display.proPerMonth;
  return `R$ ${formatBrlParts(value)} / mês`;
}

function formatDate(raw: string | null | undefined) {
  if (!raw) return "A definir";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "A definir";
  return d.toLocaleDateString("pt-BR");
}

function isIncludedForCurrentPlan(current: PlanType, target: PlanType) {
  const rank: Record<PlanType, number> = { free: 0, standart: 1, pro: 2 };
  return rank[current] >= rank[target];
}

function PlanSummaryCard({
  info,
  currentPlano,
}: {
  info: PlanCardInfo;
  currentPlano: PlanType;
}) {
  const active = currentPlano === info.tier;
  const includedByCurrent = isIncludedForCurrentPlan(currentPlano, info.tier);
  const pro = info.tier === "pro";
  const paid = info.tier !== "free";

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-neutral-800 bg-neutral-950/70",
        pro && "border-[#FF6600]/70 shadow-[0_0_24px_-14px_rgba(255,102,0,0.75)]",
        active && "ring-1 ring-[#FF6600]/70",
      )}
    >
      {pro ? (
        <div className="bg-[#FF6600] px-4 py-1 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-white">
          Plano máximo
        </div>
      ) : null}
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className={cn("text-xl text-foreground", pro && "text-[#FF6600]")}>
              {PLAN_LABELS[info.tier]}
            </CardTitle>
            <CardDescription>{info.headline}</CardDescription>
          </div>
          {active ? (
            <Badge className="bg-[#FF6600] text-white hover:bg-[#FF6600]">Atual</Badge>
          ) : includedByCurrent ? (
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
              Incluso
            </Badge>
          ) : (
            <Badge variant="outline" className="border-neutral-700 text-neutral-400">
              Upgrade
            </Badge>
          )}
        </div>

        <div>
          <p className={cn("text-2xl font-bold tracking-tight", pro ? "text-[#FF6600]" : "text-foreground")}>
            {paid ? monthlyPriceLabel(info.tier as PaidPlan) : "R$ 0,00"}
          </p>
          {paid ? (
            <p className="text-xs text-muted-foreground">
              Referência mensal. Ciclos maiores podem gerar economia no checkout.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Plano inicial com limites operacionais.</p>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-relaxed text-muted-foreground">{info.description}</p>
        <div className="rounded-lg border border-border/70 bg-background/40 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#FF6600]">Ideal para</p>
          <p className="text-sm text-foreground">{info.bestFor}</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inclui</p>
          <ul className="space-y-2">
            {info.included.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6600]" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {info.restrictions.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Restrições</p>
            <ul className="space-y-2">
              {info.restrictions.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-lg border border-[#FF6600]/25 bg-[#FF6600]/10 p-3 text-sm text-foreground">
            No PRÓ não há mensagens de restrição por plano: é o nível mais alto disponível.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PlanosPage() {
  const { plano, loading: planLoading, refetch } = useUserPlan();
  const [contract, setContract] = useState<PlanContractConfig>(DEFAULT_PLAN_CONTRACT);
  const [contractLoading, setContractLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const loadContract = useCallback(async () => {
    setContractLoading(true);
    try {
      const { data, error } = await supabase
        .from("planos_contrato_config")
        .select("titulo, versao, conteudo, vigencia_inicio, updated_at")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        toast.error("Não foi possível carregar o contrato dos planos.");
        setContract(DEFAULT_PLAN_CONTRACT);
        return;
      }

      const row = data as PlanContractConfig | null;
      setContract(row?.conteudo?.trim() ? row : DEFAULT_PLAN_CONTRACT);
    } finally {
      setContractLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContract();
  }, [loadContract]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const currentPlanCard = useMemo(
    () => PLAN_CARDS.find((p) => p.tier === plano) ?? PLAN_CARDS[0],
    [plano],
  );

  if (planLoading) {
    return (
      <div className="flex justify-center py-20 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        A carregar plano…
      </div>
    );
  }

  const showUpgrade = plano !== "pro";

  return (
    <div className="min-w-0 space-y-6">
      <section className="overflow-hidden rounded-2xl border border-[#FF6600]/25 bg-gradient-to-br from-neutral-950 via-neutral-950 to-[#1a0f05] p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("border-border", PLAN_COLORS[plano])}>
                Plano atual: {PLAN_LABELS[plano]}
              </Badge>
              {plano === "pro" ? (
                <Badge className="bg-[#FF6600] text-white hover:bg-[#FF6600]">Sem restrições de plano</Badge>
              ) : null}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Planos</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Consulte tudo o que cada plano abrange, veja os limites aplicáveis ao seu acesso e acompanhe o contrato
                de assinatura publicado pela plataforma.
              </p>
            </div>
          </div>
          {showUpgrade ? (
            <Button
              type="button"
              className="shrink-0 bg-[#FF6600] font-semibold text-white hover:bg-[#e65c00]"
              onClick={() => setUpgradeOpen(true)}
            >
              <ArrowUpRight className="mr-2 h-4 w-4" />
              {plano === "standart" ? "Fazer upgrade para PRÓ" : "Ver opções de upgrade"}
            </Button>
          ) : (
            <div className="rounded-xl border border-[#FF6600]/25 bg-[#FF6600]/10 px-4 py-3 text-sm text-foreground">
              <ShieldCheck className="mb-2 h-5 w-5 text-[#FF6600]" aria-hidden />
              O seu painel está no maior plano disponível.
            </div>
          )}
        </div>
      </section>

      {showUpgrade ? (
        <Card className="border-[#FF6600]/25 bg-[#1a1208]/70">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#FF6600]" aria-hidden />
              <div>
                <p className="font-semibold text-foreground">
                  {plano === "standart" ? "O próximo passo é o PRÓ." : "Ainda existem recursos bloqueados no seu plano."}
                </p>
                <p className="text-sm text-muted-foreground">
                  {plano === "standart"
                    ? "As mensagens de restrição passam a oferecer somente o PRÓ, pois ele libera o mini painel do motorista, presença digital e automações."
                    : "No FREE, contratos, campanhas, limites ampliados e recursos premium dependem de upgrade para STANDART ou PRÓ."}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-[#FF6600]/50 bg-transparent text-foreground hover:bg-[#FF6600]/10"
              onClick={() => setUpgradeOpen(true)}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Ver planos
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        {PLAN_CARDS.map((info) => (
          <PlanSummaryCard key={info.tier} info={info} currentPlano={plano} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Mapa de acesso por plano</CardTitle>
            <CardDescription>Resumo prático das áreas liberadas em cada nível.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[640px] overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-[1.25fr_1fr_1fr_1fr] bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="p-3">Área</div>
                <div className="p-3">FREE</div>
                <div className="p-3">STANDART</div>
                <div className="p-3">PRÓ</div>
              </div>
              {ACCESS_ROWS.map((row) => (
                <div
                  key={row.area}
                  className="grid grid-cols-[1.25fr_1fr_1fr_1fr] border-t border-border text-sm text-foreground"
                >
                  <div className="p-3 font-medium">{row.area}</div>
                  <div className="p-3 text-muted-foreground">{row.free}</div>
                  <div className="p-3 text-muted-foreground">{row.standart}</div>
                  <div className="p-3 text-[#FF6600]">{row.pro}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#FF6600]/25 bg-neutral-950/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#FF6600]" />
              Seu plano agora
            </CardTitle>
            <CardDescription>{currentPlanCard.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plano ativo</p>
              <p className="text-2xl font-bold text-foreground">{PLAN_LABELS[plano]}</p>
              <p className="mt-1 text-sm text-muted-foreground">{currentPlanCard.bestFor}</p>
            </div>
            {plano === "pro" ? (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-foreground">
                Sem avisos de restrição por plano: o PRÓ é o pacote mais completo disponível.
              </div>
            ) : (
              <div className="rounded-xl border border-[#FF6600]/25 bg-[#FF6600]/10 p-4 text-sm text-foreground">
                {plano === "standart"
                  ? "Se encontrar uma área bloqueada, a oferta correta será somente upgrade para PRÓ."
                  : "No FREE, algumas áreas aparecem bloqueadas ou limitadas até a ativação de um plano pago."}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Preços do checkout usam a tabela oficial do Mercado Pago. Referência mensal: STANDART{" "}
              <span className="text-foreground">{monthlyPriceLabel("standart")}</span> · PRÓ{" "}
              <span className="text-foreground">{monthlyPriceLabel("pro")}</span>. O ciclo selecionado no checkout pode
              alterar o total cobrado. Rótulo atual: {BILLING_CYCLE_LABELS[PAID_CYCLE]}.
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#FF6600]" />
            Contrato dos planos
          </CardTitle>
          <CardDescription>
            Documento publicado pelo Admin Master e visível aos usuários autenticados dentro do próprio painel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contractLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              A carregar contrato…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-foreground">{contract.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    Versão {contract.versao} · Vigência: {formatDate(contract.vigencia_inicio)} · Atualizado em{" "}
                    {formatDate(contract.updated_at)}
                  </p>
                </div>
                <Badge variant="outline" className="w-fit border-[#FF6600]/40 text-[#FF6600]">
                  Consulta
                </Badge>
              </div>
              <div className="max-h-[520px] overflow-y-auto rounded-xl border border-border bg-background p-4">
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
                  {contract.conteudo}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <UpgradePlanDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} emphasizePaidTiers />
    </div>
  );
}
