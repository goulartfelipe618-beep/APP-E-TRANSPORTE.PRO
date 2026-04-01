import { supabase } from "@/integrations/supabase/client";
import type { ComunicadorRow } from "@/hooks/useComunicadoresEvolution";

const DEFAULT_WEBHOOK =
  "https://n8n.e-transporte.pro/webhook/7ed2848a-93d3-4659-a271-8bfc2f10ec77";

export function getN8nComunicarWebhookUrl(): string {
  return (import.meta.env.VITE_N8N_COMUNICAR_WEBHOOK_URL as string | undefined)?.trim() || DEFAULT_WEBHOOK;
}

/** JSON-safe: datas e tipos estranhos viram string */
export function jsonSafeRecord(obj: Record<string, unknown>): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
  } catch {
    return { _erro_serializacao: true, raw: String(obj) };
  }
}

/** Só solicitações (Transfer / Grupo). Reservas usam outro fluxo/webhook. */
export type OrigemComunicarMotorista = "transfer_solicitacao" | "grupo_solicitacao";

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
 * Envia o payload ao n8n via Edge Function (servidor → n8n), evitando CORS no browser.
 * Opcionalmente `webhookUrl` no env do front para staging/outro fluxo (mesmo host permitido).
 */
export async function postMotoristaComunicarWebhook(body: Record<string, unknown>): Promise<void> {
  const urlOverride = getN8nComunicarWebhookUrl();
  const { data, error } = await supabase.functions.invoke("n8n-comunicar-proxy", {
    body: {
      payload: body,
      ...(urlOverride !== DEFAULT_WEBHOOK ? { webhookUrl: urlOverride } : {}),
    },
  });
  if (error) {
    throw new Error(
      error.message ||
        "Deploy: supabase functions deploy n8n-comunicar-proxy",
    );
  }
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(String((data as { error: string }).error));
  }
  const pack = data as { ok?: boolean; status?: number };
  if (!pack?.ok) {
    throw new Error(`Webhook n8n status ${pack?.status ?? "?"}`);
  }
}
