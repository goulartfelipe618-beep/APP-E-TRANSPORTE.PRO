import { getBillingCycleTotal, mercadoPagoPlanId, type BillingCycle } from "@/lib/billingCycles";

export type MercadoPagoPlan = "standart" | "pro";

export type MercadoPagoBrickPayload = {
  token: string;
  payment_method_id: string;
  issuer_id?: string | number | null;
  installments: number;
  payer?: {
    email?: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
};

export type MercadoPagoCheckoutResult = {
  id?: string | number;
  payment_id?: string | number | null;
  subscription_id?: string | null;
  status?: string;
  status_detail?: string | null;
  plano?: MercadoPagoPlan;
  ciclo?: BillingCycle;
};

const MP_SDK_SRC = "https://sdk.mercadopago.com/js/v2";

let sdkPromise: Promise<void> | null = null;

export function getMercadoPagoPublicKey(): string {
  const viteKey = String(import.meta.env.VITE_MP_PUBLIC_KEY ?? "").trim();
  const nextKey = String(import.meta.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? "").trim();
  return viteKey || nextKey;
}

export function getPaymentsApiBaseUrl(): string {
  return String(import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/$/, "");
}

export function isMercadoPagoBillingEnabled(): boolean {
  return false;
}

export function getMercadoPagoCheckoutAmount(plano: MercadoPagoPlan, ciclo: BillingCycle): number {
  return getBillingCycleTotal(ciclo, plano);
}

export function getMercadoPagoCheckoutDescription(plano: MercadoPagoPlan, ciclo: BillingCycle): string {
  const planLabel = plano === "pro" ? "PRÓ" : "STANDART";
  return `Assinatura ${planLabel} - ${mercadoPagoPlanId(plano, ciclo)}`;
}

export async function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.MercadoPago) return;
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${MP_SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar Mercado Pago.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = MP_SDK_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar Mercado Pago."));
    document.head.appendChild(script);
  });

  return sdkPromise;
}

export async function createMercadoPagoPayment(
  _plano: MercadoPagoPlan,
  _ciclo: BillingCycle,
  _brickPayload: MercadoPagoBrickPayload,
): Promise<MercadoPagoCheckoutResult> {
  throw new Error("Pagamento por cartão/banco está desactivado.");
}

declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      options?: { locale?: string },
    ) => {
      bricks: () => {
        create: (
          type: "cardPayment",
          containerId: string,
          settings: unknown,
        ) => Promise<{ unmount?: () => void }>;
      };
    };
  }
}
