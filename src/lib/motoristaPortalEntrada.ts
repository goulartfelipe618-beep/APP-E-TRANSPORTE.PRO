import { supabase } from "@/integrations/supabase/client";

const ENTRADA_KEY = "etp_frota_link_entrada";
const AVISO_KEY = "etp_portal_login_aviso";

export const MSG_MINI_PAINEL_SO_PELO_LINK =
  "O mini painel do motorista só abre pelo link exclusivo gerado no cadastro. O login do painel não aceita esta conta.";

/** Conta criada pelo link /frota/acesso. Não entra no login da empresa. */
export function emailEhContaDeMotoristaPortal(email: string): boolean {
  return email.trim().toLowerCase().endsWith("@motorista-frota.local");
}

type EntradaGravada = { userId?: string; token?: string };

export function lerTokenDaEntrada(raw: string | null, userId: string): string | null {
  if (!raw || !userId) return null;
  try {
    const parsed = JSON.parse(raw) as EntradaGravada;
    const token = (parsed.token ?? "").trim();
    if (!token || parsed.userId !== userId) return null;
    return token;
  } catch {
    return null;
  }
}

export function marcarEntradaPeloLinkUnico(userId: string, token: string): void {
  if (typeof window === "undefined") return;
  const limpo = token.trim();
  if (!userId || !limpo) return;
  try {
    sessionStorage.setItem(ENTRADA_KEY, JSON.stringify({ userId, token: limpo }));
  } catch {
    /* ignore */
  }
}

export function limparEntradaPeloLinkUnico(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ENTRADA_KEY);
  } catch {
    /* ignore */
  }
}

export function tokenEntradaPeloLinkUnico(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return lerTokenDaEntrada(sessionStorage.getItem(ENTRADA_KEY), userId);
  } catch {
    return null;
  }
}

export function guardarAvisoLoginPortal(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(AVISO_KEY, MSG_MINI_PAINEL_SO_PELO_LINK);
  } catch {
    /* ignore */
  }
}

export function consumirAvisoLoginPortal(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const aviso = sessionStorage.getItem(AVISO_KEY);
    sessionStorage.removeItem(AVISO_KEY);
    return aviso;
  } catch {
    return null;
  }
}

/** O servidor confirma que este token é o link deste motorista. Sem isso o painel não abre. */
export async function confirmarEntradaPeloLinkUnico(userId: string, token: string): Promise<boolean> {
  const limpo = token.trim();
  if (!userId || !limpo) return false;
  const { data, error } = await supabase.rpc("validar_entrada_portal_motorista", { p_token: limpo });
  if (error || data !== true) {
    limparEntradaPeloLinkUnico();
    return false;
  }
  marcarEntradaPeloLinkUnico(userId, limpo);
  return true;
}

export async function entradaDoPortalEstaValida(userId: string): Promise<boolean> {
  const token = tokenEntradaPeloLinkUnico(userId);
  if (!token) return false;
  const { data, error } = await supabase.rpc("validar_entrada_portal_motorista", { p_token: token });
  if (error || data !== true) {
    limparEntradaPeloLinkUnico();
    return false;
  }
  return true;
}
