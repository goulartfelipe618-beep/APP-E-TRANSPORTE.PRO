/** sessionStorage: abre Motoristas → Cadastros com formulário pré-preenchido a partir da solicitação */
export const MOTORISTA_FROM_SOLICITACAO_KEY = "etp_motorista_from_solicitacao_v1";

export interface MotoristaInitialData {
  /** ID da linha em `solicitacoes_motoristas` (solicitação no site ou cadastro de frota). */
  solicitacao_id: string;
  /**
   * Se definido, o diálogo grava com **update** nesse id (edição de motorista já cadastrado na frota).
   * RLS exige `user_id = auth.uid()`.
   */
  cadastro_row_id?: string;
  /**
   * Solicitação em aberto (webhook/automação) a concluir: **update** para `status = cadastrado` no mesmo id.
   * Mutuamente exclusivo com `cadastro_row_id` em uso típico.
   */
  completar_lead_id?: string;
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
