import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  addSessionDismissedBannerId,
  clearFullscreenSessionDismissed,
  getFullscreenBannerState,
  getSessionDismissedBannerIds,
  loadFullscreenUserMap,
  saveFullscreenUserMap,
  shouldShowFullscreenCheckbox,
} from "@/lib/fullscreenBannerUserStorage";
import type { PainelTipo } from "@/lib/painelAvisosPages";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type BannerRow = {
  id: string;
  imagem_url: string;
  incluir_motorista: boolean;
  incluir_taxi: boolean;
  paginas_motorista: string[] | null;
  paginas_taxi: string[] | null;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
  created_at: string;
};

function todayLocalISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isInDateRange(inicio: string, fim: string, today: string): boolean {
  return today >= inicio && today <= fim;
}

function matchesPage(row: BannerRow, painel: PainelTipo, activePage: string): boolean {
  if (painel === "motorista") {
    if (!row.incluir_motorista) return false;
    const pages = row.paginas_motorista || [];
    return pages.includes(activePage);
  }
  if (!row.incluir_taxi) return false;
  const pages = row.paginas_taxi || [];
  return pages.includes(activePage);
}

function pickEligibleBanner(
  rows: BannerRow[],
  painel: PainelTipo,
  activePage: string,
  userId: string,
  today: string,
): BannerRow | null {
  const sessionDismissed = new Set(getSessionDismissedBannerIds());
  const userMap = loadFullscreenUserMap(userId);

  const eligible = rows
    .filter((r) => r.ativo && isInDateRange(r.data_inicio, r.data_fim, today))
    .filter((r) => matchesPage(r, painel, activePage))
    .filter((r) => {
      const st = userMap[r.id] ?? { closeCount: 0, permanent: false };
      if (st.permanent) return false;
      if (sessionDismissed.has(r.id)) return false;
      return true;
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return eligible[0] ?? null;
}

const FADE_MS = 350;

type Props = {
  painel: PainelTipo;
  activePage: string;
};

export default function FullscreenBannerOverlay({ painel, activePage }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<BannerRow[]>([]);
  const [current, setCurrent] = useState<BannerRow | null>(null);
  const [fadingOut, setFadingOut] = useState(false);
  const [neverAgain, setNeverAgain] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id ?? null);
      if (event === "SIGNED_OUT") {
        clearFullscreenSessionDismissed();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.from("admin_fullscreen_banners").select("*").eq("ativo", true);
      if (cancelled) return;
      if (error) {
        console.error(error);
        return;
      }
      setRows((data || []) as BannerRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = todayLocalISODate();

  useEffect(() => {
    if (!userId) {
      setCurrent(null);
      return;
    }
    const next = pickEligibleBanner(rows, painel, activePage, userId, today);
    setCurrent(next);
    setNeverAgain(false);
  }, [userId, rows, painel, activePage, today, tick]);

  const closeCount = current ? getFullscreenBannerState(userId ?? "", current.id).closeCount : 0;
  const showCheckbox = current ? shouldShowFullscreenCheckbox(closeCount) : false;

  const finishClose = useCallback(() => {
    if (!userId || !current) return;
    const st = getFullscreenBannerState(userId, current.id);
    const map = loadFullscreenUserMap(userId);
    if (showCheckbox && neverAgain) {
      saveFullscreenUserMap(userId, {
        ...map,
        [current.id]: { closeCount: st.closeCount, permanent: true },
      });
    } else {
      const nextCount = st.closeCount + 1;
      saveFullscreenUserMap(userId, {
        ...map,
        [current.id]: { closeCount: nextCount, permanent: false },
      });
    }
    addSessionDismissedBannerId(current.id);
    setCurrent(null);
    setFadingOut(false);
    setNeverAgain(false);
    setTick((t) => t + 1);
  }, [userId, current, showCheckbox, neverAgain]);

  const handleClose = useCallback(() => {
    if (!current || fadingOut) return;
    setFadingOut(true);
    window.setTimeout(() => finishClose(), FADE_MS);
  }, [current, fadingOut, finishClose]);

  if (!userId || !current) return null;

  const checkboxId = `fs-banner-never-${current.id}`;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-opacity ease-out sm:p-4",
        fadingOut ? "pointer-events-none opacity-0" : "opacity-100",
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      role="dialog"
      aria-modal="true"
      aria-label="Banner promocional"
    >
      <div
        className="relative mx-auto h-[min(400px,calc(100dvh-6rem))] w-full max-w-[min(560px,calc(100vw-1.5rem))] shrink-0 overflow-hidden rounded-lg border border-white/10 shadow-2xl sm:rounded-none"
      >
        <img
          src={current.imagem_url}
          alt=""
          className="absolute inset-0 h-full w-full bg-black object-contain"
        />
        <div className="absolute left-2 right-2 top-2 z-10 flex flex-wrap items-start justify-end gap-2">
          {showCheckbox ? (
            <div className="flex max-w-full min-w-0 items-center gap-2 rounded-md bg-black/50 px-2 py-1.5 backdrop-blur-sm sm:max-w-[calc(100%-3rem)]">
              <Checkbox
                id={checkboxId}
                checked={neverAgain}
                onCheckedChange={(v) => setNeverAgain(v === true)}
                className="shrink-0 border-white/70 data-[state=checked]:bg-white data-[state=checked]:text-neutral-900"
              />
              <Label
                htmlFor={checkboxId}
                className="min-w-0 cursor-pointer text-xs font-normal leading-snug text-white sm:text-sm"
              >
                Não mostrar novamente
              </Label>
            </div>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9 shrink-0 bg-white/95 text-neutral-900 hover:bg-white"
            onClick={handleClose}
            aria-label="Fechar banner"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
