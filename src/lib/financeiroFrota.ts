import type { Tables } from "@/integrations/supabase/types";

export type FinancialTransaction = Tables<"financial_transactions">;

/** Colunas explícitas para PostgREST (evita `*` e reduz payload). */
export const FINANCIAL_TRANSACTION_COLUMNS =
  "id,user_id,kind,origin,payment_status,amount,currency,occurred_on,description,reserva_transfer_id,reserva_grupo_id,category,created_at,updated_at,is_primary,payment_method,paid_at" as const;

export const FINANCEIRO_KIND_LABEL: Record<string, string> = {
  receita: "Receita",
  despesa: "Despesa",
};

export const FINANCEIRO_ORIGIN_LABEL: Record<string, string> = {
  reserva_transfer: "Reserva transfer",
  reserva_grupo: "Reserva grupo",
  manual: "Manual",
  repasse_reserva_transfer: "Repasse motorista (transfer)",
  repasse_reserva_grupo: "Repasse motorista (grupo)",
};

export const FINANCEIRO_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  cancelled: "Cancelado",
};

/** Valores aceites em `payment_method` (constraint na BD). */
export const FINANCEIRO_PAYMENT_METHODS = ["pix", "dinheiro", "cartao", "transferencia"] as const;
export type FinanceiroPaymentMethod = (typeof FINANCEIRO_PAYMENT_METHODS)[number];

export const FINANCEIRO_PAYMENT_METHOD_LABEL: Record<FinanceiroPaymentMethod, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  transferencia: "Transferência",
};

/** Categorias sugeridas para despesas manuais (livre: guardamos texto em `category`). */
export const DESPESA_CATEGORY_PRESETS = [
  { value: "combustivel", label: "Combustível" },
  { value: "manutencao", label: "Manutenção" },
  { value: "comissao", label: "Comissão" },
  { value: "taxa_plataforma", label: "Taxa / plataforma" },
  { value: "operacional", label: "Operacional" },
  { value: "outro", label: "Outro" },
] as const;

export const RECEITA_MANUAL_PRESETS = [
  { value: "servico_avulso", label: "Serviço avulso" },
  { value: "extra", label: "Extra (espera, pedágio, etc.)" },
  { value: "outro", label: "Outro" },
] as const;

export function formatBRL(value: number): string {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function monthRangeUtc(year: number, monthIndex0: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, monthIndex0, 1));
  const end = new Date(Date.UTC(year, monthIndex0 + 1, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}
