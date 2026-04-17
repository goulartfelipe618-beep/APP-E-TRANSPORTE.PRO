import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

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
    };
    const msg = `${obj.message ?? ""} ${obj.details ?? ""}`.toLowerCase();
    if (obj.name === "AbortError" && msg.includes("lock broken")) return true;
    if (msg.includes("lock broken by another request") && msg.includes("steal")) return true;
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
}

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
