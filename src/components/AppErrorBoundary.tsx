import { Component, type ErrorInfo, type ReactNode } from "react";
import { isPainelErrorReporterActive, reportPainelError } from "@/lib/painelErrorReporter";

type Props = { children: ReactNode };
type State = { hasError: boolean; message?: string };

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error("[AppErrorBoundary]", error, errorInfo.componentStack);
    }
    if (isPainelErrorReporterActive()) {
      void reportPainelError({
        kind: "react_boundary",
        message: error.message || "React error boundary",
        stack: error.stack ?? null,
        componentStack: errorInfo.componentStack ?? null,
      });
    }
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">Algo correu mal</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {this.state.message ?? "Ocorreu um erro inesperado. Pode tentar recarregar a página."}
          </p>
          <button
            type="button"
            className="mt-6 rounded-md bg-[#FF6600] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            onClick={() => window.location.reload()}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
