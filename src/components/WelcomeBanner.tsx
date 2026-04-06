import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  clearWelcomeHiddenThisSession,
  isWelcomeHiddenThisSession,
  loadWelcomeState,
  saveWelcomeState,
  setWelcomeHiddenThisSession,
  shouldShowNeverAgainCheckbox,
} from "@/lib/welcomeBannerStorage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type PainelVariant = "motorista" | "taxi";

type Props = {
  variant: PainelVariant;
};

const FADE_MS = 350;

export default function WelcomeBanner({ variant }: Props) {
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [closeCount, setCloseCount] = useState(0);
  const [permanent, setPermanent] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [neverAgain, setNeverAgain] = useState(false);

  const applyWelcomeVisibility = useCallback((uid: string) => {
    const st = loadWelcomeState(uid);
    setCloseCount(st.closeCount);
    setPermanent(st.permanent);
    if (st.permanent) {
      setShowBanner(false);
      return;
    }
    if (isWelcomeHiddenThisSession()) {
      setShowBanner(false);
      return;
    }
    setShowBanner(true);
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        setUserId(session.user.id);
        applyWelcomeVisibility(session.user.id);
      }
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.id) {
        clearWelcomeHiddenThisSession();
        setUserId(session.user.id);
        applyWelcomeVisibility(session.user.id);
      }
      if (event === "SIGNED_OUT") {
        clearWelcomeHiddenThisSession();
        setUserId(null);
        setShowBanner(false);
        setPermanent(false);
        setCloseCount(0);
      }
    });

    return () => subscription.unsubscribe();
  }, [applyWelcomeVisibility]);

  const showCheckbox = shouldShowNeverAgainCheckbox(closeCount);

  const finishClose = useCallback(() => {
    if (!userId) return;
    const st = loadWelcomeState(userId);
    if (showCheckbox && neverAgain) {
      saveWelcomeState(userId, { closeCount: st.closeCount, permanent: true });
      setPermanent(true);
    } else {
      const next = st.closeCount + 1;
      saveWelcomeState(userId, { closeCount: next, permanent: false });
      setCloseCount(next);
    }
    setWelcomeHiddenThisSession();
    setShowBanner(false);
    setFadingOut(false);
    setNeverAgain(false);
  }, [userId, showCheckbox, neverAgain]);

  const handleClose = useCallback(() => {
    if (fadingOut) return;
    setFadingOut(true);
    window.setTimeout(() => {
      finishClose();
    }, FADE_MS);
  }, [fadingOut, finishClose]);

  if (!authReady || !userId || !showBanner || permanent) return null;

  const title =
    variant === "taxi"
      ? "Bem-vindo ao painel de Gestão de Táxi"
      : "Bem-vindo ao painel de Gestão de Frota";
  const subtitle = "Explore o menu à esquerda para aceder a todas as ferramentas do E-Transporte.pro.";

  const checkboxId = "welcome-never-again";

  return (
    <div
      className={cn(
        "border-b border-primary/25 bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5 px-4 py-3 transition-opacity ease-out",
        fadingOut ? "pointer-events-none opacity-0" : "opacity-100",
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      role="region"
      aria-label="Boas-vindas"
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 sm:flex-nowrap">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {showCheckbox ? (
            <div className="flex items-center gap-2">
              <Checkbox id={checkboxId} checked={neverAgain} onCheckedChange={(v) => setNeverAgain(v === true)} />
              <Label htmlFor={checkboxId} className="cursor-pointer text-sm font-normal leading-tight text-foreground">
                Não mostrar novamente
              </Label>
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-foreground hover:bg-primary/15"
            onClick={handleClose}
            aria-label="Fechar boas-vindas"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
