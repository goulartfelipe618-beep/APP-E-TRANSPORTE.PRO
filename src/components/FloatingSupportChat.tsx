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
 * Carrega o widget Chatwoot (SDK) uma vez por sessão da página.
 * Opcional: `VITE_CHATWOOT_BASE_URL` e `VITE_CHATWOOT_WEBSITE_TOKEN` no .env.
 */
export default function FloatingSupportChat() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
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
