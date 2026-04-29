import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { installBrowserZoomLock } from "./lib/installBrowserZoomLock";

/** Chatwoot opcional: só carrega com `VITE_CHATWOOT_ENABLED=true` e URL/token válidos (evita ERR_CONNECTION_TIMED_OUT a encher a consola). */
function initChatwootSupportWidget() {
  if (typeof window === "undefined") return;
  const path = window.location.pathname || "";
  const skipPublic =
    path === "/" ||
    path === "/login" ||
    path === "/mfa" ||
    path.startsWith("/rastreio/");
  if (skipPublic) return;

  const enabled = String(import.meta.env.VITE_CHATWOOT_ENABLED ?? "").toLowerCase();
  if (enabled !== "true" && enabled !== "1") return;

  const base = String(import.meta.env.VITE_CHATWOOT_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const token = String(import.meta.env.VITE_CHATWOOT_WEBSITE_TOKEN ?? "").trim();
  if (!base || !token) return;

  const w = window as unknown as {
    chatwootSettings?: Record<string, unknown>;
    chatwootSDK?: { run: (opts: { websiteToken: string; baseUrl: string }) => void };
  };
  w.chatwootSettings = { position: "right", type: "standard", launcherTitle: "" };

  const script = document.createElement("script");
  script.async = true;
  script.src = `${base}/packs/js/sdk.js`;
  const fail = () => {
    script.remove();
  };
  script.onerror = fail;
  const t = window.setTimeout(fail, 12_000);
  script.onload = () => {
    window.clearTimeout(t);
    try {
      w.chatwootSDK?.run({ websiteToken: token, baseUrl: base });
    } catch {
      fail();
    }
  };
  document.body.appendChild(script);
}

// --------------------------------------------------------------------------
// Silenciar AbortError benigno vindo do Web Locks / supabase-auth.
//
// Em browsers antigos (ou caches antigos), o supabase-auth pode ainda estar
// configurado com `navigatorLock` (default pré-processLock). Quando outra
// aba/instância inicia, faz `locks.request(name, { steal: true })` e aborta
// o lock anterior com:
//   AbortError: Lock broken by another request with the 'steal' option.
// É esperado/benigno — os consumidores (getUser/getSession) vão simplesmente
// tentar novamente no próximo ciclo. Não há acção do utilizador a tomar.
//
// Marcamos como handled para não poluir a consola nem accionar erro
// boundaries.
// --------------------------------------------------------------------------
if (typeof window !== "undefined") {
  const isBenignAbortError = (reason: unknown): boolean => {
    if (!reason) return false;
    const obj = reason as {
      name?: string;
      message?: string;
      details?: string;
      code?: string;
      isAcquireTimeout?: boolean;
    };
    const msg = `${obj.message ?? ""} ${obj.details ?? ""}`.toLowerCase();
    if (obj.name === "AbortError" && msg.includes("lock broken")) return true;
    if (msg.includes("lock broken by another request") && msg.includes("steal")) return true;
    if (obj.isAcquireTimeout === true) return true;
    if (msg.includes("acquiring process lock") && msg.includes("timed out")) return true;
    return false;
  };
  window.addEventListener("unhandledrejection", (ev) => {
    if (isBenignAbortError(ev.reason)) {
      ev.preventDefault();
    }
  });
  window.addEventListener("error", (ev) => {
    if (isBenignAbortError(ev.error)) {
      ev.preventDefault();
    }
  });

  installBrowserZoomLock();
  initChatwootSupportWidget();
}

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
