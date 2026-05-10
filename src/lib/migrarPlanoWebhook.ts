import { z } from "zod";

/** URL legada (n8n) — mantida como fallback se `VITE_MIGRAR_PLANO_WEBHOOK_URL` não estiver definida ou for inválida. */
export const LEGACY_MIGRAR_PLANO_WEBHOOK_URL =
  "https://n8n.e-transporte.pro/webhook/961260a3-709a-4aba-a810-dbd255875fb3";

const MAX_WEBHOOK_URL_LEN = 2048;

function isValidHttpsWebhookUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t || t.length > MAX_WEBHOOK_URL_LEN) return false;
  if (!/^https:\/\//i.test(t)) return false;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    return Boolean(u.hostname);
  } catch {
    return false;
  }
}

/**
 * URL do webhook de pedido de upgrade de plano.
 * Prioridade: `VITE_MIGRAR_PLANO_WEBHOOK_URL` (HTTPS válido) → URL legada (comportamento actual em produção).
 */
export function getMigrarPlanoWebhookUrl(): string {
  const v = import.meta.env.VITE_MIGRAR_PLANO_WEBHOOK_URL;
  const s = typeof v === "string" ? v.trim() : "";
  if (s && isValidHttpsWebhookUrl(s)) return s;
  return LEGACY_MIGRAR_PLANO_WEBHOOK_URL;
}

function clampStr(v: unknown, max: number): string {
  const t = v == null ? "" : String(v);
  return t.length > max ? t.slice(0, max) : t;
}

const upgradePlanWebhookPayloadSchema = z.object({
  user_id: z.string().uuid(),
  nome_completo: z.string().max(400),
  email: z.string().email().max(320),
  telefone: z.string().max(80),
  nome_empresa: z.string().max(300),
  cnpj: z.string().max(32),
  endereco_completo: z.string().max(4000),
  origem: z.literal("upgrade_plan_dialog"),
  enviado_em: z.string().max(64),
  mensagem: z.string().max(800),
});

export type UpgradePlanWebhookPayload = z.infer<typeof upgradePlanWebhookPayloadSchema>;

type ConfiguracoesUpgradeSlice = {
  nome_completo?: string | null;
  email?: string | null;
  telefone?: string | null;
  nome_empresa?: string | null;
  cnpj?: string | null;
  endereco_completo?: string | null;
};

/**
 * Monta e valida o JSON enviado ao webhook (tipo, tamanhos, e-mail).
 */
export function buildUpgradePlanWebhookPayload(
  userId: string,
  userEmail: string | undefined,
  cfg: ConfiguracoesUpgradeSlice | null,
):
  | { ok: true; payload: UpgradePlanWebhookPayload }
  | { ok: false; error: string } {
  const email = clampStr(cfg?.email ?? userEmail ?? "", 320).trim();
  if (!email) {
    return { ok: false, error: "E-mail em falta nas configurações e na sessão." };
  }

  const raw = {
    user_id: userId,
    nome_completo: clampStr(cfg?.nome_completo, 400),
    email,
    telefone: clampStr(cfg?.telefone, 80),
    nome_empresa: clampStr(cfg?.nome_empresa, 300),
    cnpj: clampStr(cfg?.cnpj, 32),
    endereco_completo: clampStr(cfg?.endereco_completo, 4000),
    origem: "upgrade_plan_dialog" as const,
    enviado_em: new Date().toISOString(),
    mensagem: "Pedido de upgrade / informação sobre planos FREE, STANDART ou PRÓ.",
  };

  const parsed = upgradePlanWebhookPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((e) => e.message).join(" ");
    return { ok: false, error: msg || "Dados inválidos para enviar o pedido." };
  }
  return { ok: true, payload: parsed.data };
}
