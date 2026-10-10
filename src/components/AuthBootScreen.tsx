import { useEffect, useState } from "react";

const SLOW_AFTER_MS = 12_000;

/** Spinner de arranque (login e rotas protegidas). Depois de 12s mostra uma saída, em vez de girar para sempre. */
export default function AuthBootScreen() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-[100svh] min-h-[100dvh] w-full flex-col items-center justify-center gap-4 bg-white px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      {slow ? (
        <div className="max-w-xs text-center">
          <p className="text-sm text-neutral-600">A ligação está lenta. A sessão ainda está a abrir.</p>
          <button
            type="button"
            className="mt-3 text-sm font-medium text-primary underline"
            onClick={() => window.location.reload()}
          >
            Tentar novamente
          </button>
        </div>
      ) : null}
    </div>
  );
}
