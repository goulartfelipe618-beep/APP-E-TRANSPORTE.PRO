import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  createMercadoPagoPayment,
  getMercadoPagoCheckoutAmount,
  getMercadoPagoCheckoutDescription,
  getMercadoPagoPublicKey,
  loadMercadoPagoSdk,
  type MercadoPagoBrickPayload,
  type MercadoPagoPlan,
} from "@/lib/mercadoPagoBilling";
import { scheduleUserPlanRefetchWithBackoff } from "@/lib/userPlanRefetch";
import { type BillingCycle } from "@/lib/billingCycles";

interface MercadoPagoCardPaymentBrickProps {
  plano: MercadoPagoPlan;
  ciclo: BillingCycle;
  disabled?: boolean;
  onApproved?: () => void;
}

const CARD_PAYMENT_CONTAINER_ID = "cardPaymentBrick_container";

function normalizeBrickPayload(raw: unknown): MercadoPagoBrickPayload {
  const r = (raw || {}) as Record<string, unknown>;
  const payer = (r.payer || {}) as Record<string, unknown>;
  const identification = ((payer.identification || {}) as Record<string, unknown>) ?? {};
  return {
    token: String(r.token || ""),
    payment_method_id: String(r.payment_method_id || ""),
    issuer_id: (r.issuer_id as string | number | null | undefined) ?? null,
    installments: Number(r.installments || 1),
    payer: {
      email: typeof payer.email === "string" ? payer.email : undefined,
      identification: {
        type: typeof identification.type === "string" ? identification.type : undefined,
        number: typeof identification.number === "string" ? identification.number : undefined,
      },
    },
  };
}

export default function MercadoPagoCardPaymentBrick({
  plano,
  ciclo,
  disabled = false,
  onApproved,
}: MercadoPagoCardPaymentBrickProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<{ unmount?: () => void } | null>(null);
  const planRefetchCancelRef = useRef<(() => void) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    const publicKey = getMercadoPagoPublicKey();
    const amount = getMercadoPagoCheckoutAmount(plano, ciclo);

    async function mountBrick() {
      setLoading(true);
      setError(null);
      try {
        if (!publicKey) {
          throw new Error("Chave pública Mercado Pago não configurada.");
        }

        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        if (cancelled) return;

        const container = containerRef.current;
        if (!container || !container.isConnected || container.id !== CARD_PAYMENT_CONTAINER_ID) {
          throw new Error("Container do Mercado Pago não encontrado no DOM.");
        }

        await loadMercadoPagoSdk();
        if (cancelled) return;
        if (!window.MercadoPago) {
          throw new Error("SDK Mercado Pago indisponível.");
        }

        controllerRef.current?.unmount?.();
        container.replaceChildren();
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        const bricksBuilder = mp.bricks();
        controllerRef.current = await bricksBuilder.create("cardPayment", CARD_PAYMENT_CONTAINER_ID, {
          initialization: {
            amount,
          },
          customization: {
            paymentMethods: {
              maxInstallments: 12,
            },
            visual: {
              style: {
                theme: "dark",
              },
            },
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) setLoading(false);
            },
            onError: (err: unknown) => {
              const msg = err instanceof Error ? err.message : "Erro no formulário Mercado Pago.";
              if (!cancelled) {
                setError(msg);
                setLoading(false);
              }
            },
            onSubmit: (formData: unknown) =>
              new Promise<void>((resolve, reject) => {
                const payload = normalizeBrickPayload(formData);
                void createMercadoPagoPayment(plano, ciclo, payload)
                  .then((result) => {
                    const status = String(result.status || "").toLowerCase();
                    if (status === "approved" || status === "authorized") {
                      toast.success("Pagamento aprovado. O seu plano será atualizado automaticamente.");
                      planRefetchCancelRef.current?.();
                      planRefetchCancelRef.current = scheduleUserPlanRefetchWithBackoff();
                      onApproved?.();
                    } else {
                      toast.message(
                        status
                          ? `Pagamento recebido pelo Mercado Pago com status: ${status}.`
                          : "Pagamento recebido pelo Mercado Pago.",
                      );
                    }
                    resolve();
                  })
                  .catch((e) => {
                    const msg = e instanceof Error ? e.message : "Não foi possível processar o pagamento.";
                    toast.error(msg);
                    reject(e);
                  });
              }),
          },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao carregar Mercado Pago.";
        if (!cancelled) {
          setError(msg);
          setLoading(false);
        }
      }
    }

    void mountBrick();

    return () => {
      cancelled = true;
      planRefetchCancelRef.current?.();
      planRefetchCancelRef.current = null;
      controllerRef.current?.unmount?.();
      controllerRef.current = null;
    };
  }, [ciclo, disabled, onApproved, plano]);

  if (disabled) {
    return null;
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-3 flex items-start gap-2 text-xs text-neutral-400">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6600]" aria-hidden />
        <span>
          Checkout transparente Mercado Pago. Parcelamento nativo até 12x, conforme aprovação do emissor.
          <br />
          <span className="text-neutral-500">{getMercadoPagoCheckoutDescription(plano, ciclo)}</span>
        </span>
      </div>
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin text-[#FF6600]" aria-hidden />
          A carregar formulário seguro…
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
      ) : null}
      <div
        id={CARD_PAYMENT_CONTAINER_ID}
        ref={containerRef}
        className={loading ? "min-h-[220px] opacity-40" : "min-h-[220px]"}
      />
    </div>
  );
}
