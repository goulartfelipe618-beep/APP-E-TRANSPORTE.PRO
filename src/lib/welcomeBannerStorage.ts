/** Oculto neste separador até novo login (`SIGNED_IN`). */
export const WELCOME_SESSION_HIDDEN_KEY = "etp_welcome_banner_hidden_session";

export type WelcomeBannerPersisted = {
  /** Quantas vezes o utilizador fechou o banner sem «Não mostrar novamente». */
  closeCount: number;
  /** Se true, nunca mais exibir (após marcar checkbox na 3.ª+ exibição). */
  permanent: boolean;
};

function storageKeyUser(userId: string): string {
  return `etp_welcome_banner_user:${userId}`;
}

export function loadWelcomeState(userId: string): WelcomeBannerPersisted {
  try {
    const raw = localStorage.getItem(storageKeyUser(userId));
    if (!raw) return { closeCount: 0, permanent: false };
    const p = JSON.parse(raw) as Partial<WelcomeBannerPersisted>;
    return {
      closeCount: typeof p.closeCount === "number" ? p.closeCount : 0,
      permanent: p.permanent === true,
    };
  } catch {
    return { closeCount: 0, permanent: false };
  }
}

export function saveWelcomeState(userId: string, state: WelcomeBannerPersisted): void {
  try {
    localStorage.setItem(storageKeyUser(userId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** Checkbox a partir da 3.ª exibição → closeCount >= 2 antes de mostrar esta instância. */
export function shouldShowNeverAgainCheckbox(closeCount: number): boolean {
  return closeCount >= 2;
}

export function isWelcomeHiddenThisSession(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(WELCOME_SESSION_HIDDEN_KEY) === "1";
}

export function setWelcomeHiddenThisSession(): void {
  try {
    sessionStorage.setItem(WELCOME_SESSION_HIDDEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearWelcomeHiddenThisSession(): void {
  try {
    sessionStorage.removeItem(WELCOME_SESSION_HIDDEN_KEY);
  } catch {
    /* ignore */
  }
}
