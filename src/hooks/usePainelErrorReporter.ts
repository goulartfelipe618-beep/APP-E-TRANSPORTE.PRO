import { useEffect } from "react";
import {
  initPainelErrorReporter,
  shutdownPainelErrorReporter,
  type PainelKind,
} from "@/lib/painelErrorReporter";

/**
 * Regista `error`, `unhandledrejection` e (via AppErrorBoundary) erros React
 * na tabela `painel_client_error_logs` para o Admin Master consultar.
 */
export function usePainelErrorReporter(painel: PainelKind, navStorageKey: string) {
  useEffect(() => {
    initPainelErrorReporter({ painel, navStorageKey });
    return () => shutdownPainelErrorReporter();
  }, [painel, navStorageKey]);
}
