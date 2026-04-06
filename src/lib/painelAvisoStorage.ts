/** 8 horas após fechar o aviso (snooze até reaparecer). */
export const AVISO_SNOOZE_MS = 8 * 60 * 60 * 1000;

export type StoredAvisoState = {
  /** Não exibir mais para este utilizador neste dispositivo. */
  permanent?: boolean;
  /** Epoch ms: ocultar até este instante (inclusive reaparecer depois com checkbox). */
  snoozeUntil?: number;
};

export type AvisoDisplayMode = "hidden" | "first" | "second";

function storageKeyUser(userId: string): string {
  return `etp_aviso_user_state:${userId}`;
}

/** Migra `etp_aviso_dismissed:<id> === "1"` (comportamento antigo) para permanente. */
function mergeLegacyPermanentDismissing(map: Record<string, StoredAvisoState>): void {
  if (typeof window === "undefined") return;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("etp_aviso_dismissed:") && localStorage.getItem(k) === "1") {
        const id = k.replace("etp_aviso_dismissed:", "");
        map[id] = { ...map[id], permanent: true };
      }
    }
  } catch {
    /* ignore */
  }
}

export function loadUserAvisoMap(userId: string): Record<string, StoredAvisoState> {
  try {
    const raw = localStorage.getItem(storageKeyUser(userId));
    const parsed: Record<string, StoredAvisoState> = raw ? (JSON.parse(raw) as Record<string, StoredAvisoState>) : {};
    mergeLegacyPermanentDismissing(parsed);
    return parsed;
  } catch {
    return {};
  }
}

export function saveUserAvisoMap(userId: string, map: Record<string, StoredAvisoState>): void {
  try {
    localStorage.setItem(storageKeyUser(userId), JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/**
 * - `first`: primeira vez — só botão fechar, sem "Não mostrar novamente".
 * - `second`: após snooze de 8h — checkbox + fechar.
 * - `hidden`: permanente ou dentro do snooze de 8h.
 */
export function getAvisoDisplayMode(
  avisoId: string,
  map: Record<string, StoredAvisoState>,
  now: number,
): AvisoDisplayMode {
  const s = map[avisoId];
  if (!s) return "first";
  if (s.permanent) return "hidden";
  if (s.snoozeUntil !== undefined && s.snoozeUntil > now) return "hidden";
  return "second";
}

/** Primeiro fechar: inicia snooze de 8h. */
export function applyFirstDismiss(
  userId: string,
  avisoId: string,
  map: Record<string, StoredAvisoState>,
  now: number,
): Record<string, StoredAvisoState> {
  const next = { ...map, [avisoId]: { ...map[avisoId], snoozeUntil: now + AVISO_SNOOZE_MS } };
  saveUserAvisoMap(userId, next);
  return next;
}

/** Segundo fechar: opcionalmente permanente; senão novo snooze de 8h. */
export function applySecondDismiss(
  userId: string,
  avisoId: string,
  neverAgain: boolean,
  map: Record<string, StoredAvisoState>,
  now: number,
): Record<string, StoredAvisoState> {
  let next: Record<string, StoredAvisoState>;
  if (neverAgain) {
    next = { ...map, [avisoId]: { permanent: true } };
  } else {
    next = { ...map, [avisoId]: { ...map[avisoId], snoozeUntil: now + AVISO_SNOOZE_MS } };
  }
  saveUserAvisoMap(userId, next);
  return next;
}
