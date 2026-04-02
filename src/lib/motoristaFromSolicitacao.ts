/** sessionStorage: abre Motoristas → Cadastros com formulário pré-preenchido a partir da solicitação */
export const MOTORISTA_FROM_SOLICITACAO_KEY = "etp_motorista_from_solicitacao_v1";

export interface MotoristaInitialData {
  solicitacao_id: string;
  nome?: string;
  email?: string;
  telefone?: string;
  cpf?: string;
  cnh?: string;
  cidade?: string;
  estado?: string;
  mensagem_observacoes?: string;
  dados_webhook?: Record<string, unknown> | null;
}

export function parseDadosWebhook(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

export function pickStr(dw: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = dw[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return "";
}
