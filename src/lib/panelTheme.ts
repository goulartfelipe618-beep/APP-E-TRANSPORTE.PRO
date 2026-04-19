import { getPersistedSupabaseUserId } from "@/lib/supabaseSessionUser";

/** Painéis com preferência de tema isolada (não partilham a mesma chave). */
export type PanelThemeKind = "frota" | "taxi" | "admin";

/**
 * Última classe aplicada ao <html>. Lida pelo script bloqueante em `index.html`
 * para evitar flash branco→dark (ou dark→branco) ao boot/refresh.
 */
const LAST_APPLIED_KEY = "etp_theme_last_applied";

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

/** Persiste o último estado aplicado (independente de uid) para boot rápido sem flash. */
function persistLastApplied(dark: boolean) {
  try {
    localStorage.setItem(LAST_APPLIED_KEY, dark ? "dark" : "light");
  } catch {
    /* ignore */
  }
}

export function applyDocumentClassDark(dark: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const has = root.classList.contains("dark");
  // Evita re-aplicar quando já está no estado correcto (impede flicker em
  // refresh de token / re-render do onAuthStateChange).
  if (has !== dark) {
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
  }
  persistLastApplied(dark);
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

/**
 * Detecta o painel a partir de uma rota e aplica o tema do utilizador para ela.
 * Usado pela tela de Login imediatamente antes de `navigate(path)` para evitar
 * o flash branco→dark quando o utilizador volta a entrar.
 */
export function applyThemeForRoute(path: string, userId: string | null) {
  const panel: PanelThemeKind = path.startsWith("/admin")
    ? "admin"
    : path.startsWith("/taxi")
      ? "taxi"
      : "frota";
  applyPanelThemeFromStorage(panel, userId);
}

/** Remove preferências de tema guardadas para este utilizador (ex.: após exclusão da conta). */
export function clearPanelThemePrefsForUser(userId: string) {
  if (typeof window === "undefined" || !userId) return;
  const panels: PanelThemeKind[] = ["frota", "taxi", "admin"];
  for (const panel of panels) {
    try {
      const raw = localStorage.getItem(storageKey(panel));
      if (!raw) continue;
      const p = JSON.parse(raw) as { userId?: string };
      if (p.userId === userId) localStorage.removeItem(storageKey(panel));
    } catch {
      /* ignore */
    }
  }
}
