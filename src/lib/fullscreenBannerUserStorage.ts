import { shouldShowNeverAgainCheckbox } from "@/lib/welcomeBannerStorage";

const SESSION_KEY = "etp_fullscreen_dismissed_session";

function userMapKey(userId: string): string {
  return `etp_fullscreen_banner_user:${userId}`;
}

export type FullscreenBannerPersisted = {
  closeCount: number;
  permanent: boolean;
};

export type FullscreenBannerUserMap = Record<string, FullscreenBannerPersisted>;

export function loadFullscreenUserMap(userId: string): FullscreenBannerUserMap {
  try {
    const raw = localStorage.getItem(userMapKey(userId));
    if (!raw) return {};
    return JSON.parse(raw) as FullscreenBannerUserMap;
  } catch {
    return {};
  }
}

export function saveFullscreenUserMap(userId: string, map: FullscreenBannerUserMap): void {
  try {
    localStorage.setItem(userMapKey(userId), JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getFullscreenBannerState(
  userId: string,
  bannerId: string,
): FullscreenBannerPersisted {
  const m = loadFullscreenUserMap(userId);
  return m[bannerId] ?? { closeCount: 0, permanent: false };
}

export function shouldShowFullscreenCheckbox(closeCount: number): boolean {
  return shouldShowNeverAgainCheckbox(closeCount);
}

export function getSessionDismissedBannerIds(): string[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addSessionDismissedBannerId(bannerId: string): void {
  try {
    const ids = getSessionDismissedBannerIds();
    if (!ids.includes(bannerId)) ids.push(bannerId);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function clearFullscreenSessionDismissed(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
