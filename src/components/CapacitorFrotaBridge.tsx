import { useEffect } from "react";
import { applyFrotaDeepLink, isCapacitorNative } from "@/lib/capacitorFrota";

/**
 * No site isto não corre. No APK/IPA, um link /frota/acesso/:token
 * (ou etransporte://frota/acesso/:token) cai na rota que o React já tem.
 */
export default function CapacitorFrotaBridge() {
  useEffect(() => {
    if (!isCapacitorNative()) return;

    let remove = () => {};
    let cancelled = false;

    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        if (cancelled) return;
        const sub = await App.addListener("appUrlOpen", (event) => {
          if (event.url) applyFrotaDeepLink(event.url);
        });
        if (cancelled) {
          void sub.remove();
          return;
        }
        remove = () => {
          void sub.remove();
        };
      } catch {
        /* sem plugin nativo o portal continua na rota normal */
      }
    })();

    return () => {
      cancelled = true;
      remove();
    };
  }, []);

  return null;
}
