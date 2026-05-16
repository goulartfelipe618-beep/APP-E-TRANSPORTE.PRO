import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Chave sessionStorage do operador da frota — não reutilizar no portal do motorista. */
export const DASHBOARD_NAV_STORAGE_KEY = "etp_nav_dashboard";

/** Utilizador criado pelo link `/frota/acesso/:token` (metadata definida no bootstrap). */
export function userIsMotoristaFrotaFromMetadata(user: User | null | undefined): boolean {
  if (!user) return false;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  if (meta?.app_role === "motorista_frota") return true;
  if (meta?.solicitacao_motorista_id != null && String(meta.solicitacao_motorista_id).length > 0) return true;
  return false;
}

export function clearDashboardNavSessionStorage(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(DASHBOARD_NAV_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Página exibida ao entrar no painel (logo E-Transporte à direita). */
export const DASHBOARD_ENTRADA_PAGE = "entrada";

/** Garante que o painel do operador abre na tela de entrada, não num submenu guardado. */
export function setDashboardNavToEntrada(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DASHBOARD_NAV_STORAGE_KEY, DASHBOARD_ENTRADA_PAGE);
  } catch {
    /* ignore */
  }
}

/** @deprecated Use setDashboardNavToEntrada */
export const setDashboardNavToHome = setDashboardNavToEntrada;

/** Utilizador é motorista da frota (submotorista com portal activado). */
export async function isMotoristaFrotaUser(userId: string, user?: User | null): Promise<boolean> {
  if (userIsMotoristaFrotaFromMetadata(user)) return true;

  const { data, error } = await supabase
    .from("solicitacoes_motoristas")
    .select("id")
    .eq("portal_auth_user_id", userId)
    .maybeSingle();
  if (error) return false;
  return data != null;
}
