import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Check, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PLAN_LABELS, PLAN_PRICE_LABELS, useUserPlan, type PlanType } from "@/hooks/useUserPlan";
import { buildUpgradePlanWebhookPayload, getMigrarPlanoWebhookUrl } from "@/lib/migrarPlanoWebhook";
import {
  BILLING_CYCLES,
  BILLING_CYCLE_LABELS,
  PAID_PLAN_CYCLE_PRICES,
  type StripeBillingCycle,
} from "@/lib/stripeBillingCycles";
import {
  fetchStripeCheckoutConfigured,
  isStripeBillingEnabled,
  startStripeSubscriptionCheckout,
} from "@/lib/stripeBilling";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando true (ex.: gate de plano), destaca STANDART e PRÓ — pedido típico de upgrade. */
  emphasizePaidTiers?: boolean;
}

const FREE_FEATURES = [
  "Painel completo e Financeiro",
  "Transfer e Grupos — Reservas (até 3 por dia)",
  "Motoristas — até 3 cadastros",
  "Clientes ilimitados",
  "Geolocalização — até 3 links/mês",
  "Receptivos e QR Codes ilimitados",
  "Network, Comunidade, Disparador e Empty Legs (beta)",
  "Anotações e Suporte",
];

const STANDART_FEATURES = [
  "Tudo do FREE, com reservas e motoristas ilimitados",
  "Contratos Transfer e Grupos",
  "Campanhas (Ativos e Leads)",
  "Link do mini painel do motorista continua a exigir PRÓ",
];

const PRO_FEATURES = [
  "Tudo do STANDART",
  "Solicitações (Transfer, Grupos e Motoristas)",
  "Link do mini painel do motorista ativo",
  "E-mail Business, Website, Domínios",
  "Automações",
  "Prioridade nas integrações premium",
];

function PlanCard({
  tier,
  highlight,
  features,
}: {
  tier: PlanType;
  highlight?: boolean;
  features: string[];
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border p-4 sm:p-5",
        highlight
          ? "border-[#FF6600]/60 bg-[#FF6600]/10 shadow-[0_0_0_1px_rgba(255,102,0,0.15)]"
          : "border-neutral-700 bg-neutral-900/80",
      )}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold tracking-tight text-white">{PLAN_LABELS[tier]}</h3>
        {tier === "free" ? (
          <p className="text-xl font-semibold text-[#FF6600]">{PLAN_PRICE_LABELS.free}</p>
        ) : (
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Preços por ciclo</p>
        )}
      </div>
      {tier !== "free" ? (
        <ul className="mb-3 space-y-1.5 rounded-lg border border-neutral-800 bg-neutral-950/50 px-3 py-2">
          {BILLING_CYCLES.map((c) => (
            <li key={c} className="flex items-center justify-between gap-2 text-sm text-neutral-200">
              <span className="text-neutral-400">{BILLING_CYCLE_LABELS[c]}</span>
              <span className="font-semibold tabular-nums text-[#FF6600]">
                {PAID_PLAN_CYCLE_PRICES[c][tier === "standart" ? "standart" : "pro"]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mb-3 text-xs text-neutral-400">
        {tier === "free" && "Entrada na plataforma com limites claros para operação diária."}
        {tier === "standart" && "Operação completa com contratos e marketing de campanhas."}
        {tier === "pro" && "Suite premium: solicitações, portal do motorista e canais digitais."}
      </p>
      <ul className="flex-1 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex gap-2 text-sm text-neutral-200">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6600]" aria-hidden />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function UpgradePlanDialog({
  open,
  onOpenChange,
  emphasizePaidTiers = false,
}: UpgradePlanDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [stripeTier, setStripeTier] = useState<null | "standart" | "pro">(null);
  const [billingCycle, setBillingCycle] = useState<StripeBillingCycle>("monthly");
  const viteStripe = isStripeBillingEnabled();
  /** null = a consultar o servidor quando VITE não força o modo Stripe */
  const [serverStripeConfigured, setServerStripeConfigured] = useState<boolean | null>(() =>
    viteStripe ? true : null,
  );
  const stripeOn = viteStripe || serverStripeConfigured === true;
  const stripeChecking = !viteStripe && serverStripeConfigured === null;
  const { plano: currentPlano, refetch: refetchPlano } = useUserPlan();

  useEffect(() => {
    if (!open) setSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (open) void refetchPlano();
  }, [open, refetchPlano]);

  useEffect(() => {
    if (!open) return;
    if (viteStripe) {
      setServerStripeConfigured(true);
      return;
    }
    setServerStripeConfigured(null);
    let cancelled = false;
    void fetchStripeCheckoutConfigured().then((ok) => {
      if (!cancelled) setServerStripeConfigured(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [open, viteStripe]);

  const handleStripe = async (tier: "standart" | "pro") => {
    setStripeTier(tier);
    try {
      await startStripeSubscriptionCheckout(tier, billingCycle);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Não foi possível iniciar o pagamento.");
    } finally {
      setStripeTier(null);
    }
  };

  const handleMigrar = async () => {
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

      const res = await fetch(getMigrarPlanoWebhookUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(built.payload),
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "max-h-[min(94vh,920px)] w-[min(100vw-1rem,min(92vw,720px))] max-w-[min(100vw-1rem,min(92vw,720px))] gap-0 overflow-hidden p-0 sm:rounded-xl",
          "border-neutral-800 bg-neutral-950",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Planos FREE, STANDART e PRÓ</DialogTitle>
          <DialogDescription>Comparativo de funcionalidades e preços por ciclo de subscrição.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(70vh,680px)] overflow-y-auto border-b border-neutral-800 bg-neutral-950 px-4 py-5 sm:px-6">
          {emphasizePaidTiers ? (
            <p className="mb-4 text-center text-sm text-neutral-200">
              Esta área não está incluída no plano <span className="font-semibold text-[#FF6600]">FREE</span>. Os seus dados
              mantêm-se na conta — escolha <span className="font-medium text-foreground">STANDART</span> ou{" "}
              <span className="font-medium text-foreground">PRÓ</span> para desbloquear.
            </p>
          ) : (
            <p className="mb-4 text-center text-sm text-neutral-300">
              {stripeOn
                ? "Compare os planos e subscreva com cartão (Stripe) ou peça contacto comercial."
                : "Escolha o plano que melhor encaixa na sua operação. O administrador confirma e ativa na sua conta."}
            </p>
          )}
          <div
            className={cn(
              "grid gap-4",
              emphasizePaidTiers ? "sm:grid-cols-2" : "sm:grid-cols-3",
            )}
          >
            {!emphasizePaidTiers ? <PlanCard tier="free" features={FREE_FEATURES} /> : null}
            <PlanCard tier="standart" features={STANDART_FEATURES} />
            <PlanCard tier="pro" highlight features={PRO_FEATURES} />
          </div>
        </div>

        <div className="space-y-3 bg-neutral-950 px-4 py-4 sm:px-6 sm:py-5">
          <p className="text-center text-xs text-neutral-400">
            Se o plano pago terminar, os seus dados não são apagados — o acesso às funções premium fica suspenso até renovar.
          </p>
          {stripeChecking ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#FF6600]" aria-hidden />
              <p className="text-center text-sm text-neutral-400">A carregar opções de pagamento…</p>
            </div>
          ) : stripeOn ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                <p className="mb-2 text-center text-xs font-medium text-neutral-300">
                  Ciclo de pagamento no checkout
                </p>
                <RadioGroup
                  value={billingCycle}
                  onValueChange={(v) => setBillingCycle(v as StripeBillingCycle)}
                  className="grid gap-2 sm:grid-cols-2"
                  disabled={stripeTier !== null}
                >
                  {BILLING_CYCLES.map((c) => (
                    <div
                      key={c}
                      className="flex items-center gap-2 rounded-md border border-neutral-800/80 bg-neutral-950/60 px-2 py-2"
                    >
                      <RadioGroupItem value={c} id={`cycle-${c}`} className="border-neutral-500 text-[#FF6600]" />
                      <Label
                        htmlFor={`cycle-${c}`}
                        className="cursor-pointer text-sm font-normal text-neutral-200"
                      >
                        {BILLING_CYCLE_LABELS[c]}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center sm:flex-wrap">
                <Button
                  type="button"
                  className="w-full bg-[#FF6600] font-semibold uppercase tracking-wide text-white hover:bg-[#e65c00] sm:min-w-[180px]"
                  disabled={
                    stripeTier !== null ||
                    currentPlano === "standart" ||
                    currentPlano === "pro"
                  }
                  onClick={() => void handleStripe("standart")}
                >
                  {stripeTier === "standart" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A redirecionar…
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Subscrever STANDART
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  className="w-full border border-[#FF6600]/50 bg-[#FF6600]/15 font-semibold uppercase tracking-wide text-white hover:bg-[#FF6600]/25 sm:min-w-[180px]"
                  disabled={stripeTier !== null || currentPlano === "pro"}
                  onClick={() => void handleStripe("pro")}
                >
                  {stripeTier === "pro" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A redirecionar…
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Subscrever PRÓ
                    </>
                  )}
                </Button>
              </div>
              <p className="text-center text-[11px] text-neutral-500">
                Pagamento seguro pela Stripe. O plano é activado automaticamente após confirmação.
              </p>
              <div className="relative py-1 text-center text-[11px] text-neutral-500">
                <span className="bg-neutral-950 px-2 relative z-10">ou</span>
                <span className="absolute left-0 right-0 top-1/2 h-px bg-neutral-800 -z-0" aria-hidden />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full border-neutral-600 bg-transparent font-semibold uppercase tracking-wide text-white hover:bg-white/10"
                disabled={submitting || stripeTier !== null}
                onClick={() => void handleMigrar()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A enviar…
                  </>
                ) : (
                  "Pedir contacto comercial (sem cartão)"
                )}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
              <Button
                type="button"
                className="w-full bg-[#FF6600] font-semibold uppercase tracking-wide text-white hover:bg-[#e65c00] sm:min-w-[220px] sm:flex-1"
                disabled={submitting}
                onClick={() => void handleMigrar()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A enviar…
                  </>
                ) : (
                  "Pedir STANDART ou PRÓ"
                )}
              </Button>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-full border-neutral-600 bg-transparent font-semibold uppercase tracking-wide text-white hover:bg-white/10 sm:min-w-[140px]"
              disabled={submitting || stripeTier !== null}
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
