import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPersistedSupabaseUserId } from "@/lib/supabaseSessionUser";
import {
  applyDocumentClassDark,
  applyPanelThemeFromStorage,
  readPanelThemePref,
  writePanelThemePref,
  type PanelThemeKind,
} from "@/lib/panelTheme";

export function usePanelTheme(panel: PanelThemeKind) {
  const [darkMode, setDarkMode] = useState(() => {
    const uid = getPersistedSupabaseUserId();
    return uid ? readPanelThemePref(panel, uid) : false;
  });

  useLayoutEffect(() => {
    const uid = getPersistedSupabaseUserId();
    applyPanelThemeFromStorage(panel, uid);
    setDarkMode(uid ? readPanelThemePref(panel, uid) : false);
  }, [panel]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
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
