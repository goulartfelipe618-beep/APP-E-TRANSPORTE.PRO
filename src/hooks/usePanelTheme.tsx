import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPersistedSupabaseUserId } from "@/lib/supabaseSessionUser";
import {
  applyDocumentClassDark,
  applyPanelThemeFromStorage,
  readPanelThemePref,
  writePanelThemePref,
  type PanelThemeKind,
} from "@/lib/panelTheme";

/**
 * Hook de tema por painel. Estratégia para zero flash:
 *  - O `<head>` em index.html aplica o último tema sincronamente antes de React montar.
 *  - `useState` lê o uid persistido (síncrono) na primeira render.
 *  - `useLayoutEffect` apenas reaplica se for diferente.
 *  - `onAuthStateChange` ignora eventos de mero refresh de token (TOKEN_REFRESHED) e
 *    só reage quando o uid muda (login/logout).
 */
export function usePanelTheme(panel: PanelThemeKind) {
  const [darkMode, setDarkMode] = useState(() => {
    const uid = getPersistedSupabaseUserId();
    return uid ? readPanelThemePref(panel, uid) : false;
  });
  const lastUidRef = useRef<string | null>(getPersistedSupabaseUserId());

  useLayoutEffect(() => {
    const uid = getPersistedSupabaseUserId();
    lastUidRef.current = uid;
    applyPanelThemeFromStorage(panel, uid);
    setDarkMode(uid ? readPanelThemePref(panel, uid) : false);
  }, [panel]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignora eventos que não alteram o utilizador (refresh de token / focus).
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
      const uid = session?.user?.id ?? null;
      if (uid === lastUidRef.current) return;
      lastUidRef.current = uid;
      applyPanelThemeFromStorage(panel, uid);
      setDarkMode(uid ? readPanelThemePref(panel, uid) : false);
    });
    return () => sub.subscription.unsubscribe();
  }, [panel]);

  const toggle = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setDarkMode((prev) => {
      const next = !prev;
      writePanelThemePref(panel, user.id, next);
      applyDocumentClassDark(next);
      return next;
    });
  }, [panel]);

  return { darkMode, toggle };
}
