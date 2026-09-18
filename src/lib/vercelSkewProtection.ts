/** ID do deploy Vercel (Skew Protection: mesmo HTML fala com o mesmo `/api`). */
export function getVercelDeploymentId(): string {
  return String(import.meta.env.VITE_VERCEL_DEPLOYMENT_ID ?? "").trim();
}

export function isVercelSkewProtectionEnabled(): boolean {
  const flag = String(import.meta.env.VITE_VERCEL_SKEW_PROTECTION_ENABLED ?? "").trim();
  return flag === "1" && Boolean(getVercelDeploymentId());
}

export function vercelDeploymentHeaders(): Record<string, string> {
  if (!isVercelSkewProtectionEnabled()) return {};
  return { "x-deployment-id": getVercelDeploymentId() };
}

function shouldPinUrl(raw: string): boolean {
  try {
    const u = new URL(raw, window.location.origin);
    if (u.origin !== window.location.origin) return false;
    return u.pathname.startsWith("/api/") || u.pathname === "/api";
  } catch {
    return false;
  }
}

/** Encaminha fetch same-origin `/api` para o deploy que serviu este JS. */
export function installVercelSkewProtection(): void {
  if (typeof window === "undefined") return;
  if (!isVercelSkewProtectionEnabled()) return;
  const id = getVercelDeploymentId();
  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (!shouldPinUrl(raw)) return orig(input, init);
    const headers = new Headers(init?.headers);
    if (!headers.has("x-deployment-id")) headers.set("x-deployment-id", id);
    return orig(input, { ...init, headers });
  };
}
