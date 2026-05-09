import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ZOOM_MIN = 70;
const ZOOM_MAX = 100;
const DEFAULT_ZOOM = 100;

function storageKey(uid: string) {
  return `etp_painel_zoom_v1_${uid}`;
}

export function clampPainelZoomPercent(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_ZOOM;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(n)));
}

type PainelContentZoomContextValue = {
  zoomPercent: number;
  draftZoom: number;
  setDraftZoom: (v: number) => void;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  saveZoom: () => Promise<void>;
  saving: boolean;
  reload: () => Promise<void>;
  ready: boolean;
};

const PainelContentZoomContext = createContext<PainelContentZoomContextValue | null>(null);

export function usePainelContentZoom(): PainelContentZoomContextValue {
  const ctx = useContext(PainelContentZoomContext);
  if (!ctx) {
    throw new Error("usePainelContentZoom must be used within PainelContentZoomProvider");
  }
  return ctx;
}

export function PainelContentZoomProvider({ children }: { children: ReactNode }) {
  const [zoomPercent, setZoomPercent] = useState(DEFAULT_ZOOM);
  const [draftZoom, setDraftZoom] = useState(DEFAULT_ZOOM);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    setReady(false);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setZoomPercent(DEFAULT_ZOOM);
      setDraftZoom(DEFAULT_ZOOM);
      setReady(true);
      return;
    }

    let fromDb: number | null = null;
    const { data, error } = await supabase
      .from("configuracoes")
      .select("painel_zoom_percent")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data && typeof (data as { painel_zoom_percent?: unknown }).painel_zoom_percent === "number") {
      fromDb = clampPainelZoomPercent(Number((data as { painel_zoom_percent: number }).painel_zoom_percent));
    }

    if (fromDb != null) {
      setZoomPercent(fromDb);
      setDraftZoom(fromDb);
      try {
        localStorage.setItem(storageKey(user.id), String(fromDb));
      } catch {
        /* ignore */
      }
      setReady(true);
      return;
    }

    try {
      const raw = localStorage.getItem(storageKey(user.id));
      if (raw) {
        const z = clampPainelZoomPercent(Number(raw));
        setZoomPercent(z);
        setDraftZoom(z);
      } else {
        setZoomPercent(DEFAULT_ZOOM);
        setDraftZoom(DEFAULT_ZOOM);
      }
    } catch {
      setZoomPercent(DEFAULT_ZOOM);
      setDraftZoom(DEFAULT_ZOOM);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (dialogOpen) setDraftZoom(zoomPercent);
  }, [dialogOpen, zoomPercent]);

  const saveZoom = useCallback(async () => {
    const z = clampPainelZoomPercent(draftZoom);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão inválida.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("configuracoes")
        .update({
          painel_zoom_percent: z,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) {
        try {
          localStorage.setItem(storageKey(user.id), String(z));
        } catch {
          /* ignore */
        }
        setZoomPercent(z);
        toast.message("Zoom salvo neste dispositivo", {
          description: "Não foi possível sincronizar com o servidor; tente de novo mais tarde.",
        });
      } else {
        setZoomPercent(z);
        try {
          localStorage.setItem(storageKey(user.id), String(z));
        } catch {
          /* ignore */
        }
        toast.success("Zoom da área principal salvo.");
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }, [draftZoom]);

  const value = useMemo<PainelContentZoomContextValue>(
    () => ({
      zoomPercent,
      draftZoom,
      setDraftZoom,
      dialogOpen,
      setDialogOpen,
      saveZoom,
      saving,
      reload,
      ready,
    }),
    [zoomPercent, draftZoom, dialogOpen, saveZoom, saving, reload, ready],
  );

  return (
    <PainelContentZoomContext.Provider value={value}>{children}</PainelContentZoomContext.Provider>
  );
}
