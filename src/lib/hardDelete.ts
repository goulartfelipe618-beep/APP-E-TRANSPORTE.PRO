import { clearPanelThemePrefsForUser } from "@/lib/panelTheme";

/**
 * Política global: exclusões no painel devem refletir DELETE permanente no Postgres (sem soft delete).
 * - Orquestra limpeza de estado local quando um utilizador deixa de existir neste dispositivo.
 * - RPC `service_delete_user_owned_data` + Auth: ver migração e Edge Function admin-users.
 */

/** Mesma chave que `ConfiguracoesContext` (evita import circular). */
const ETP_CONFIGURACOES_SESSION = "etp_configuracoes_v1";

export const ETP_HARD_DELETE_EVENT = "etp-hard-delete";

export type HardDeleteEventDetail = {
  /** Tabela lógica ou recurso (opcional, para listeners). */
  scope?: string;
  /** Id do registo removido (opcional). */
  id?: string;
};

/** Dispara atualização de UI/cache após remoção bem-sucedida no servidor. */
export function dispatchHardDeleteEvent(detail: HardDeleteEventDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ETP_HARD_DELETE_EVENT, { detail }));
}

/** Remove chaves de armazenamento local associadas a um userId (outro utilizador ou o atual após purge). */
export function purgeStoredStateForUserId(userId: string) {
  if (typeof window === "undefined" || !userId) return;

  try {
    localStorage.removeItem(`etp_aviso_user_state:${userId}`);
    localStorage.removeItem(`etp_fullscreen_banner_user:${userId}`);
  } catch {
    /* ignore */
  }

  clearPanelThemePrefsForUser(userId);

  try {
    const raw = sessionStorage.getItem(ETP_CONFIGURACOES_SESSION);
    if (raw) {
      const payload = JSON.parse(raw) as { userId?: string };
      if (payload.userId === userId) sessionStorage.removeItem(ETP_CONFIGURACOES_SESSION);
    }
  } catch {
    /* ignore */
  }

  dispatchHardDeleteEvent({ scope: "user-storage", id: userId });
}
