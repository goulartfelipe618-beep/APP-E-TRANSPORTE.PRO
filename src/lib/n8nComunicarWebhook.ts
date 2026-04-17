import { supabase } from "@/integrations/supabase/client";
import type { ComunicadorRow } from "@/hooks/useComunicadoresEvolution";

/** Tipos alinhados às colunas em `sistema_webhooks_comunicacao` e à Edge Function `comunicar-webhook-dispatch`. */
export type WebhookComunicacaoTipo =
  | "transfer_solicitacao"
  | "transfer_reserva"
  | "grupo_solicitacao"
  | "grupo_reserva"
  | "motorista_intake"
  | "motoristas_cadastrados"
  | "geolocalizacao";

/** @deprecated use WebhookComunicacaoTipo */
export type OrigemComunicarMotorista = Exclude<
  WebhookComunicacaoTipo,
  "motorista_intake" | "motoristas_cadastrados" | "geolocalizacao"
>;

/** JSON-safe: datas e tipos estranhos viram string */
export function jsonSafeRecord(obj: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
  } catch {
    return { _erro_serializacao: true, raw: String(obj) };
  }
}

export async function fetchMotoristaPainelSnapshot(): Promise<Record<string, unknown>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { autenticado: false };
  }

  const meta = (user.user_metadata || {}) as Record<string, unknown>;

  const { data: conf } = await supabase
    .from("configuracoes")
    .select("nome_completo, nome_projeto, logo_url")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    autenticado: true,
    user_id: user.id,
    email: user.email ?? null,
    nome_completo: conf?.nome_completo ?? meta.full_name ?? meta.name ?? null,
    nome_projeto: conf?.nome_projeto ?? null,
    telefone_metadata: meta.phone ?? meta.telefone ?? null,
    avatar_url: meta.avatar_url ?? null,
  };
}

export function buildComunicadorSnapshot(
  canal: "oficial" | "proprio",
  sistema: ComunicadorRow | null,
  own: ComunicadorRow | null,
): Record<string, unknown> {
  const telOf = sistema?.telefone_conectado?.trim() || null;
  const telOwn = own?.telefone_conectado?.trim() || null;
  return {
    canal_escolhido: canal,
    linha_oficial: telOf
      ? {
          telefone_e164: telOf,
          nome_dispositivo: sistema?.nome_dispositivo ?? null,
          instance_name: sistema?.instance_name ?? null,
          connection_status: sistema?.connection_status ?? null,
          comunicador_id: sistema?.id ?? null,
        }
      : null,
    linha_propria_motorista: telOwn
      ? {
          telefone_e164: telOwn,
          nome_dispositivo: own?.nome_dispositivo ?? null,
          instance_name: own?.instance_name ?? null,
          connection_status: own?.connection_status ?? null,
          rotulo: own?.rotulo ?? null,
          comunicador_id: own?.id ?? null,
        }
      : null,
  };
}

/**
 * Mensagens amigáveis por tipo quando o webhook não está configurado.
 * Alinhado às colunas em `sistema_webhooks_comunicacao`.
 */
const TIPO_LABEL: Record<WebhookComunicacaoTipo, string> = {
  transfer_solicitacao: "Transfer — solicitação",
  transfer_reserva: "Transfer — reserva",
  grupo_solicitacao: "Grupo — solicitação",
  grupo_reserva: "Grupo — reserva",
  motorista_intake: "Cadastro de motorista",
  motoristas_cadastrados: "Motoristas cadastrados",
  geolocalizacao: "Geolocalização (link de rastreio)",
};

/**
 * `supabase-js` embrulha respostas não-2xx como FunctionsHttpError e omite o corpo
 * ("Edge Function returned a non-2xx status code"). Esta função extrai o `error`
 * JSON que a nossa Edge Function devolve para darmos ao utilizador uma mensagem útil.
 */
async function extractEdgeFunctionError(err: unknown): Promise<string | null> {
  if (!err || typeof err !== "object") return null;
  const ctx = (err as { context?: unknown }).context;
  if (!ctx) return null;

  // O supabase-js v2 coloca o Response original em err.context.
  if (typeof (ctx as Response).clone === "function") {
    try {
      const cloned = (ctx as Response).clone();
      const text = await cloned.text();
      if (!text) return null;
      try {
        const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
        if (typeof parsed.error === "string") return parsed.error;
        if (typeof parsed.message === "string") return parsed.message;
      } catch {
        return text;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Envia o payload ao webhook configurado pelo Admin Master (URL no banco, nunca no cliente).
 * Em caso de webhook não configurado devolve uma mensagem específica e acionável.
 */
export async function dispatchComunicarWebhook(
  tipo: WebhookComunicacaoTipo,
  payload: Record<string, unknown>,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("comunicar-webhook-dispatch", {
    body: { tipo, payload },
  });

  if (error) {
    const bodyMsg = await extractEdgeFunctionError(error);
    const fallback =
      `Webhook "${TIPO_LABEL[tipo]}" ainda não está configurado. ` +
      "Peça ao administrador master para preencher a URL em Admin → Comunicador (Webhooks).";
    throw new Error(bodyMsg || error.message || fallback);
  }

  if (data && typeof data === "object" && "error" in data) {
    throw new Error(String((data as { error: string }).error));
  }

  const pack = data as { ok?: boolean; status?: number };
  if (!pack?.ok) {
    throw new Error(`Webhook retornou status ${pack?.status ?? "?"}`);
  }
}
