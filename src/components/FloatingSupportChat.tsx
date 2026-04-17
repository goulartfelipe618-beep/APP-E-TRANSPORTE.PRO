import { useEffect, useRef } from "react";

declare global {
  interface Window {
    chatwootSettings?: Record<string, unknown>;
    chatwootSDK?: { run: (opts: { websiteToken: string; baseUrl: string }) => void };
  }
}

const DEFAULT_CHATWOOT_BASE_URL = "https://chatwoot.e-transporte.pro";
const DEFAULT_CHATWOOT_WEBSITE_TOKEN = "dvGfRaS9f9KKx3XkVjQreZwU";

/**
 * Interpreta um valor de env como booleano "ligado".
 * Aceita: "1", "true", "yes", "on" (case-insensitive). Vazio/undefined → false.
 */
function isEnabled(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * Carrega o widget Chatwoot (SDK) uma vez por sessão da página.
 *
 * Gating:
 *   O widget só é injetado se `VITE_CHATWOOT_ENABLED` estiver a `true`.
 *   Mantido desligado por defeito porque o iframe servido por
 *   `chatwoot.e-transporte.pro` é frequentemente intercetado por antivírus
 *   (ex.: Kaspersky Web Anti-Virus) que injetam uma CSP Report-Only própria,
 *   poluindo a consola dos utilizadores finais sem qualquer impacto funcional.
 *
 * Config opcional (só lida se `VITE_CHATWOOT_ENABLED=true`):
 *   - `VITE_CHATWOOT_BASE_URL`
 *   - `VITE_CHATWOOT_WEBSITE_TOKEN`
 */
export default function FloatingSupportChat() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;

    const enabled = isEnabled(import.meta.env.VITE_CHATWOOT_ENABLED as string | undefined);
    if (!enabled) return;

    started.current = true;

    const baseUrl = (import.meta.env.VITE_CHATWOOT_BASE_URL as string | undefined)?.trim() || DEFAULT_CHATWOOT_BASE_URL;
    const websiteToken =
      (import.meta.env.VITE_CHATWOOT_WEBSITE_TOKEN as string | undefined)?.trim() || DEFAULT_CHATWOOT_WEBSITE_TOKEN;

    window.chatwootSettings = {
      position: "right",
      type: "standard",
      launcherTitle: "",
    };

    const g = document.createElement("script");
    const s = document.getElementsByTagName("script")[0];
    g.src = `${baseUrl.replace(/\/$/, "")}/packs/js/sdk.js`;
    g.async = true;
    s?.parentNode?.insertBefore(g, s);
    g.onload = () => {
      window.chatwootSDK?.run({
        websiteToken,
        baseUrl: baseUrl.replace(/\/$/, ""),
      });
    };
  }, []);

  return null;
}
