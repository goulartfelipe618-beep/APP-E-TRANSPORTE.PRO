/**
 * Bloqueia o zoom da página pelo browser (pinch com dois dedos, Ctrl+scroll, gestos WebKit).
 * Aplica-se a todas as rotas e perfis (motorista executivo, táxi, admin master).
 * O viewport em index.html (maximum-scale=1) é o reforço principal em mobile.
 */
export function installBrowserZoomLock(): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  const block = (e: Event) => {
    e.preventDefault();
  };

  const gestureEvents = ["gesturestart", "gesturechange", "gestureend"] as const;
  for (const type of gestureEvents) {
    document.addEventListener(type, block, { passive: false });
  }

  window.addEventListener(
    "wheel",
    (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false },
  );
}
