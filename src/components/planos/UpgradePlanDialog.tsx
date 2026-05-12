import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Bolt,
  Check,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PLAN_LABELS, useUserPlan, type PlanType } from "@/hooks/useUserPlan";
import { buildUpgradePlanWebhookPayload, getMigrarPlanoWebhookUrl } from "@/lib/migrarPlanoWebhook";
import {
  BILLING_CYCLES,
  BILLING_CYCLE_LABELS,
  formatBrlParts,
  getBillingCycleDisplay,
  type BillingCycle,
} from "@/lib/billingCycles";
import { getMercadoPagoPublicKey, isMercadoPagoBillingEnabled } from "@/lib/mercadoPagoBilling";
import MercadoPagoCardPaymentBrick from "@/components/planos/MercadoPagoCardPaymentBrick";

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando true (ex.: gate de plano), destaca STANDART e PRÓ — pedido típico de upgrade. */
  emphasizePaidTiers?: boolean;
}

type FeatureLine = { text: string; ok: boolean; tag?: string };
type FeatureSection = { title: string; lines: FeatureLine[] };

const STANDART_FEATURE_SECTIONS: FeatureSection[] = [
  {
    title: "Operação sem limites FREE",
    lines: [
      { text: "Reservas ilimitadas (Transfer e Grupos)", ok: true },
      { text: "Motoristas, veículos e clientes sem tecto do plano FREE", ok: true },
      { text: "Geolocalização e rastreios além dos 3 links/mês do FREE", ok: true },
    ],
  },
  {
    title: "Contratos & formalização",
    lines: [
      { text: "Contratos digitais Transfer e Grupos com histórico", ok: true },
      { text: "Fluxo comercial alinhado à sua frota executiva", ok: true },
    ],
  },
  {
    title: "Marketing & captação",
    lines: [
      { text: "Campanhas (Ativos e Leads) com acompanhamento", ok: true },
      { text: "Receptivos e QR Codes ilimitados para divulgação", ok: true },
    ],
  },
  {
    title: "Gestão & finanças",
    lines: [
      { text: "Painel financeiro completo, métricas e lançamentos", ok: true },
      { text: "Mini painel do motorista com link dedicado", ok: false, tag: "PRÓ" },
    ],
  },
];

const PRO_FEATURE_SECTIONS: FeatureSection[] = [
  {
    title: "Tudo do STANDART",
    lines: [{ text: "Incluído por completo — contratos, campanhas e operação ilimitada", ok: true }],
  },
  {
    title: "Captação & experiência do motorista",
    lines: [
      { text: "Solicitações (Transfer, Grupos e Motoristas) centralizadas", ok: true },
      { text: "Mini painel do motorista com acesso seguro por link", ok: true },
      { text: "Documentos, onboarding e comunicação alinhados à frota", ok: true },
    ],
  },
  {
    title: "Marca & presença online",
    lines: [
      { text: "Website integrado ao seu negócio", ok: true },
      { text: "E-mail Business profissional", ok: true },
      { text: "Domínios próprios e gestão de presença digital", ok: true },
    ],
  },
  {
    title: "Automação, integrações & escala",
    lines: [
      { text: "Automações avançadas (filas, formulários, mensagens)", ok: true },
      { text: "Integrações premium e prioridade nas novidades", ok: true },
      { text: "Ferramentas de escala: disparador, comunidade e operações", ok: true },
    ],
  },
];

function CycleSegmentedControl({
  value,
  onChange,
  disabled,
}: {
  value: BillingCycle;
  onChange: (c: BillingCycle) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-1 rounded-xl border border-neutral-800 bg-neutral-900/80 p-1 sm:grid-cols-4",
        disabled && "pointer-events-none opacity-60",
      )}
      role="tablist"
      aria-label="Ciclo de faturação"
    >
      {BILLING_CYCLES.map((c) => {
        const meta = getBillingCycleDisplay(c);
        const save = meta.standartSavePercent;
        const active = value === c;
        return (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(c)}
            className={cn(
              "flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-center transition-colors",
              active
                ? "bg-[#FF6600] text-white shadow-sm"
                : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-200",
            )}
          >
            <span className="text-[10px] font-semibold leading-tight sm:text-[11px]">{BILLING_CYCLE_LABELS[c]}</span>
            {save != null ? (
              <span
                className={cn(
                  "text-[8px] font-bold leading-none sm:text-[9px]",
                  active ? "text-white/90" : "text-emerald-400",
                )}
              >
                −{save}%
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function PlanFeatureSections({
  sections,
  dense,
}: {
  sections: FeatureSection[];
  dense?: boolean;
}) {
  return (
    <div className={cn("space-y-4", dense && "space-y-3")}>
      {sections.map((sec) => (
        <div key={sec.title}>
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-500">{sec.title}</p>
          <ul className="space-y-0 border-t border-neutral-800/80">
            {sec.lines.map((line) => (
              <li
                key={line.text}
                className={cn(
                  "flex gap-2 border-b border-neutral-800/80 py-2 text-[11px] leading-snug sm:text-xs",
                  line.ok ? "text-neutral-100" : "text-neutral-500",
                )}
              >
                {line.ok ? (
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6600]" aria-hidden />
                ) : (
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-600" aria-hidden />
                )}
                <span className="min-w-0 flex-1">{line.text}</span>
                {line.tag ? (
                  <span className="shrink-0 rounded bg-[#FF6600]/20 px-1.5 py-0.5 text-[8px] font-bold uppercase text-[#FF6600]">
                    {line.tag}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PlanPriceBlock({
  tier,
  cycle,
  isPro,
}: {
  tier: "standart" | "pro";
  cycle: BillingCycle;
  isPro: boolean;
}) {
  const d = getBillingCycleDisplay(cycle);
  const perMonth = tier === "standart" ? d.standartPerMonth : d.proPerMonth;
  const save = tier === "standart" ? d.standartSavePercent : d.proSavePercent;
  const totalFmt = tier === "standart" ? d.standartTotalFormatted : d.proTotalFormatted;
  const amount = formatBrlParts(perMonth);

  return (
    <div>
      <div className="mb-1 flex items-baseline gap-0.5">
        <span className="text-[11px] font-semibold text-neutral-400">R$</span>
        <span
          className={cn("text-[1.35rem] font-bold leading-none tracking-tight sm:text-2xl", isPro && "text-[#FF6600]")}
        >
          {amount}
        </span>
        <span className="text-[10px] text-neutral-500">/mês</span>
      </div>
      <p className="text-[10px] text-neutral-500">
        Equiv. mensal · {BILLING_CYCLE_LABELS[cycle]}
        {cycle !== "monthly" ? (
          <>
            {" "}
            · Total <span className="tabular-nums text-neutral-400">R$ {totalFmt}</span>
          </>
        ) : null}
      </p>
      {save != null ? (
        <span className="mt-1 inline-block rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
          Poupa ~{save}% vs. mensal
        </span>
      ) : null}
    </div>
  );
}

export default function UpgradePlanDialog({
  open,
  onOpenChange,
  emphasizePaidTiers = false,
}: UpgradePlanDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [paymentTier, setPaymentTier] = useState<null | "standart" | "pro">(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const checkoutAreaRef = useRef<HTMLDivElement | null>(null);
  const mercadoPagoOn = isMercadoPagoBillingEnabled();
  const mercadoPagoPublicKey = getMercadoPagoPublicKey();
  const { plano: currentPlano, refetch: refetchPlano } = useUserPlan();

  const isFree = currentPlano === "free";
  const isStandart = currentPlano === "standart";
  const isPro = currentPlano === "pro";
  const showStandartColumn = isFree;
  const showProColumn = !isPro;

  useEffect(() => {
    if (!open) setSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (open) void refetchPlano();
  }, [open, refetchPlano]);

  useEffect(() => {
    if (!open) setPaymentTier(null);
  }, [open]);

  useEffect(() => {
    if (!paymentTier) return;
    window.requestAnimationFrame(() => {
      checkoutAreaRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [paymentTier]);

  const openMercadoPagoCheckout = (tier: "standart" | "pro") => {
    if (!mercadoPagoOn || !mercadoPagoPublicKey) {
      toast.error("Mercado Pago não está configurado. Use o contacto comercial ou configure MP_PUBLIC_KEY.");
      return;
    }
    setPaymentTier((current) => (current === tier ? null : tier));
  };

  const handleMigrar = async (preferPro?: boolean) => {
    setSubmitting(true);
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) {
        toast.error("Sessão inválida. Inicie sessão novamente.");
        return;
      }

      const { data: cfg, error: cfgErr } = await supabase
        .from("configuracoes")
        .select("nome_completo, email, telefone, nome_empresa, cnpj, endereco_completo")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cfgErr) {
        console.error(cfgErr);
        toast.error("Não foi possível ler as suas configurações.");
        return;
      }

      const built = buildUpgradePlanWebhookPayload(user.id, user.email ?? undefined, cfg);
      if (!built.ok) {
        toast.error(built.error);
        return;
      }

      const payload = preferPro
        ? {
            ...built.payload,
            mensagem: `${built.payload.mensagem} Prioridade: upgrade PRÓ.`.slice(0, 800),
          }
        : built.payload;

      const res = await fetch(getMigrarPlanoWebhookUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        toast.error(t ? `Erro ao enviar pedido (${res.status})` : `Erro ao enviar pedido (${res.status}).`);
        return;
      }

      toast.success("Em breve um dos administradores entrará em contacto para o plano pretendido.");
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao enviar o pedido.");
    } finally {
      setSubmitting(false);
    }
  };

  const topNotice = (() => {
    if (isPro) return null;
    if (isStandart) {
      return {
        icon: Sparkles,
        text: "Está no plano STANDART. Faça upgrade para PRÓ para desbloquear o mini painel do motorista, website, domínios, e-mail business e automações avançadas — é o plano mais completo da plataforma.",
      };
    }
    if (emphasizePaidTiers) {
      return {
        icon: Lock,
        text: "Esta área exige um plano pago. Escolha STANDART ou PRÓ abaixo para desbloquear — os seus dados mantêm-se sempre na conta.",
      };
    }
    return {
      icon: Lock,
      text: `Está no plano ${PLAN_LABELS.free}. Suba para STANDART ou PRÓ para remover limites e aceder a funções premium — sem perder informação.`,
    };
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "max-h-[min(94vh,920px)] w-[min(100vw-1rem,min(92vw,800px))] max-w-[min(100vw-1rem,min(92vw,800px))] gap-0 overflow-hidden p-0 sm:rounded-xl",
          "border-neutral-800 bg-neutral-950",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Planos FREE, STANDART e PRÓ</DialogTitle>
          <DialogDescription>Comparativo de funcionalidades e preços por ciclo de subscrição.</DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "overflow-y-auto border-b border-neutral-800 bg-neutral-950 px-4 py-5 sm:px-6",
            paymentTier ? "max-h-[min(36vh,360px)]" : "max-h-[min(70vh,720px)]",
          )}
        >
          {isPro ? (
            <div className="mx-auto max-w-md space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FF6600]/15">
                <ShieldCheck className="h-7 w-7 text-[#FF6600]" aria-hidden />
              </div>
              <h2 className="text-lg font-bold tracking-tight text-white">Plano PRÓ activo</h2>
              <p className="text-sm text-neutral-400">
                Tem acesso à suite completa — não há restrições de plano no painel. Continue a explorar todas as áreas
                disponíveis.
              </p>
              <div className="rounded-xl border border-[#FF6600]/30 bg-[#FF6600]/5 p-4 text-left">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#FF6600]">Incluído no seu PRÓ</p>
                <ul className="space-y-1.5 text-xs text-neutral-300">
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6600]" /> Mini painel do motorista e
                    solicitações
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6600]" /> Website, e-mail business e domínios
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6600]" /> Automações e integrações premium
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <>
              {topNotice ? (
                <div className="mb-4 flex gap-2 rounded-xl border border-[#FF6600]/25 bg-[#1a1208]/90 px-3 py-2.5 text-xs leading-snug text-amber-100/95 sm:text-sm">
                  <topNotice.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6600]" aria-hidden />
                  <span>{topNotice.text}</span>
                </div>
              ) : null}

              {!isStandart ? (
                <p className="mb-3 text-center text-[11px] text-neutral-500 sm:text-xs">
                  Ciclo de faturação · compare a poupança em relação ao mensal
                </p>
              ) : (
                <p className="mb-3 text-center text-[11px] text-neutral-500 sm:text-xs">
                  Escolha o ciclo de pagamento para o upgrade PRÓ
                </p>
              )}

              <div className="mb-5">
                <CycleSegmentedControl
                  value={billingCycle}
                  onChange={setBillingCycle}
                  disabled={paymentTier !== null}
                />
              </div>

              <div
                className={cn(
                  "grid gap-2 sm:gap-3",
                  showStandartColumn && showProColumn ? "sm:grid-cols-2" : "mx-auto w-full max-w-md sm:max-w-lg",
                )}
              >
                {showStandartColumn ? (
                  <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
                    <div className="border-b border-neutral-800 px-3 py-3 sm:px-4 sm:py-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                        STANDART
                      </p>
                      <PlanPriceBlock tier="standart" cycle={billingCycle} isPro={false} />
                      <p className="mt-2 text-[10.5px] leading-relaxed text-neutral-400">
                        Operação completa: contratos, campanhas e limites FREE removidos — ideal para frotas em
                        crescimento.
                      </p>
                    </div>
                    <div className="flex-1 px-3 py-3 sm:px-4 sm:py-4">
                      <PlanFeatureSections sections={STANDART_FEATURE_SECTIONS} dense />
                    </div>
                  </div>
                ) : null}

                {showProColumn ? (
                  <div className="relative flex flex-col overflow-hidden rounded-xl border-2 border-[#FF6600] bg-[#0c0a06] shadow-[0_0_24px_-8px_rgba(255,102,0,0.35)]">
                    <span className="block bg-[#FF6600] py-1 text-center text-[9px] font-bold uppercase tracking-[0.08em] text-white">
                      Mais popular
                    </span>
                    <div className="border-b border-neutral-800/80 px-3 py-3 sm:px-4 sm:py-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF6600]">PRÓ</p>
                      <PlanPriceBlock tier="pro" cycle={billingCycle} isPro />
                      <p className="mt-2 text-[10.5px] leading-relaxed text-neutral-400">
                        Suite máxima: portal do motorista, presença digital profissional e automações — o pacote mais
                        completo.
                      </p>
                    </div>
                    <div className="flex-1 px-3 py-3 sm:px-4 sm:py-4">
                      <PlanFeatureSections sections={PRO_FEATURE_SECTIONS} dense />
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div
          ref={checkoutAreaRef}
          className={cn(
            "space-y-3 bg-neutral-950 px-4 py-4 sm:px-6 sm:py-5",
            paymentTier && "max-h-[min(58vh,600px)] overflow-y-auto",
          )}
        >
          {!isPro ? (
            <div className="flex gap-2 rounded-lg border border-neutral-800 bg-neutral-900/30 px-3 py-2.5 text-[11px] leading-relaxed text-neutral-400 sm:text-xs">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6600]" aria-hidden />
              <span>
                Ao cancelar a subscrição, os seus dados são preservados — o acesso às funções pagas fica suspenso até
                renovar.
              </span>
            </div>
          ) : null}

          {mercadoPagoOn && !isPro ? (
            <div className="flex flex-col gap-3">
              {isFree ? (
                <>
                  <Button
                    type="button"
                    className="h-12 w-full gap-2 bg-[#FF6600] text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-[#FF6600]/20 hover:bg-[#e65c00]"
                    disabled={paymentTier === "standart"}
                    onClick={() => openMercadoPagoCheckout("pro")}
                  >
                    {paymentTier === "pro" ? (
                      <>
                        <CreditCard className="h-4 w-4" /> Formulário PRÓ aberto
                      </>
                    ) : (
                      <>
                        <Bolt className="h-4 w-4" />
                        Assinar PRÓ agora
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full border-2 border-neutral-600 bg-transparent text-xs font-semibold uppercase tracking-wider text-neutral-100 hover:border-[#FF6600] hover:bg-[#FF6600]/10 hover:text-white"
                    disabled={paymentTier === "pro" || currentPlano === "standart"}
                    onClick={() => openMercadoPagoCheckout("standart")}
                  >
                    {paymentTier === "standart" ? (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" /> Formulário STANDART aberto
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Assinar STANDART
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  className="h-12 w-full gap-2 bg-[#FF6600] text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-[#FF6600]/20 hover:bg-[#e65c00]"
                  onClick={() => openMercadoPagoCheckout("pro")}
                >
                  {paymentTier === "pro" ? (
                    <>
                      <CreditCard className="h-4 w-4" /> Formulário PRÓ aberto
                    </>
                  ) : (
                    <>
                      <Bolt className="h-4 w-4" />
                      Fazer upgrade para PRÓ
                    </>
                  )}
                </Button>
              )}
              <p className="flex items-center justify-center gap-1.5 text-center text-[10px] text-neutral-500 sm:text-[11px]">
                <Lock className="h-3 w-3 shrink-0" aria-hidden />
                Pagamento seguro via Mercado Pago · Parcelamento nativo até 12x
              </p>
              {paymentTier ? (
                <MercadoPagoCardPaymentBrick
                  key={`${paymentTier}-${billingCycle}`}
                  plano={paymentTier}
                  ciclo={billingCycle}
                  onApproved={() => {
                    void refetchPlano();
                    onOpenChange(false);
                  }}
                />
              ) : null}
              <div className="relative py-1 text-center text-[10px] text-neutral-600 sm:text-[11px]">
                <span className="relative z-10 bg-neutral-950 px-2">ou</span>
                <span className="absolute left-0 right-0 top-1/2 -z-0 h-px bg-neutral-800" aria-hidden />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full border-neutral-600 bg-transparent text-xs font-semibold text-neutral-200 hover:bg-white/5"
                disabled={submitting}
                onClick={() => void handleMigrar(!isFree)}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A enviar…
                  </>
                ) : isStandart ? (
                  "Pedir contacto — upgrade PRÓ (sem cartão)"
                ) : (
                  "Pedir contacto comercial (sem cartão)"
                )}
              </Button>
            </div>
          ) : !isPro ? (
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                className="h-12 w-full bg-[#FF6600] text-xs font-bold uppercase tracking-wider text-white hover:bg-[#e65c00]"
                disabled={submitting}
                onClick={() => void handleMigrar(!isFree)}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A enviar…
                  </>
                ) : isStandart ? (
                  "Pedir upgrade PRÓ"
                ) : (
                  "Pedir STANDART ou PRÓ"
                )}
              </Button>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full border-neutral-600 bg-transparent text-xs font-semibold uppercase tracking-wide text-white hover:bg-white/10 sm:min-w-[140px]"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
