import { useEffect, useId, useRef, useState } from "react";
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
import { type BillingCycle } from "@/lib/billingCycles";

interface MercadoPagoCardPaymentBrickProps {
  plano: MercadoPagoPlan;
  ciclo: BillingCycle;
  disabled?: boolean;
  onApproved?: () => void;
}

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
  const reactId = useId();
  const containerId = `mp-card-payment-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const controllerRef = useRef<{ unmount?: () => void } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        await loadMercadoPagoSdk();
        if (cancelled) return;
        if (!window.MercadoPago) {
          throw new Error("SDK Mercado Pago indisponível.");
        }

        controllerRef.current?.unmount?.();
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        const bricksBuilder = mp.bricks();
        controllerRef.current = await bricksBuilder.create("cardPayment", containerId, {
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
              console.error(err);
              const msg = err instanceof Error ? err.message : "Erro no formulário Mercado Pago.";
              if (!cancelled) setError(msg);
            },
            onSubmit: (formData: unknown) =>
              new Promise<void>((resolve, reject) => {
                const payload = normalizeBrickPayload(formData);
                void createMercadoPagoPayment(plano, ciclo, payload)
                  .then((result) => {
                    const status = String(result.status || "").toLowerCase();
                    if (status === "approved" || status === "authorized") {
                      toast.success("Pagamento aprovado. O seu plano será atualizado automaticamente.");
                      window.dispatchEvent(new Event("etp-user-plan-refetch"));
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
      controllerRef.current?.unmount?.();
      controllerRef.current = null;
    };
  }, [ciclo, containerId, onApproved, plano]);

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
      <div id={containerId} className={loading ? "min-h-[220px] opacity-40" : ""} />
    </div>
  );
}
