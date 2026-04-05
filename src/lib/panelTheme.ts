import { getPersistedSupabaseUserId } from "@/lib/supabaseSessionUser";

/** Painéis com preferência de tema isolada (não partilham a mesma chave). */
export type PanelThemeKind = "frota" | "taxi" | "admin";

function storageKey(panel: PanelThemeKind): string {
  return `etp_theme_${panel}_v1`;
}

export function readPanelThemePref(panel: PanelThemeKind, userId: string): boolean {
  try {
    const raw = localStorage.getItem(storageKey(panel));
    if (!raw) return false;
    const p = JSON.parse(raw) as { userId?: string; dark?: boolean };
    if (p.userId !== userId) return false;
    return p.dark === true;
  } catch {
    return false;
  }
}

export function writePanelThemePref(panel: PanelThemeKind, userId: string, dark: boolean) {
  try {
    localStorage.setItem(storageKey(panel), JSON.stringify({ userId, dark }));
  } catch {
    /* quota / private mode */
  }
}

export function applyDocumentClassDark(dark: boolean) {
  if (typeof document === "undefined") return;
  if (dark) document.documentElement.classList.add("dark");
  else document.documentElement.classList.remove("dark");
}

/** Aplica o tema guardado para o painel e utilizador atuais (ou claro se não houver sessão). */
export function applyPanelThemeFromStorage(panel: PanelThemeKind, userId: string | null) {
  if (!userId) {
    applyDocumentClassDark(false);
    return;
  }
  applyDocumentClassDark(readPanelThemePref(panel, userId));
}

/** Garante que o tema do painel está correto ao montar o layout (ex.: após troca de rota frota ↔ táxi). */
export function syncPanelThemeForCurrentUser(panel: PanelThemeKind) {
  applyPanelThemeFromStorage(panel, getPersistedSupabaseUserId());
}
