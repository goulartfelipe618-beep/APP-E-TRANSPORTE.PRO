import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthStartedAt, isAuthExpired, readAuthStartedAt, setAuthStartedAt } from "@/lib/authExpiry";
import { tokenAplicativoMotoristaGuardado } from "@/lib/capacitorFrota";
import { saidaDoMiniPainelEhLocal, tokenEntradaPeloLinkUnico } from "@/lib/motoristaPortalEntrada";

const CHECK_EVERY_MS = 5 * 60 * 1000;

export default function AuthExpiryGuard() {
  const navigate = useNavigate();
  const expiredHandledRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const handleExpiry = async () => {
      if (!mounted) return;
      if (expiredHandledRef.current) return;
      expiredHandledRef.current = true;

      const noMiniPainel = saidaDoMiniPainelEhLocal(window.location.pathname);
      const { data: atual } = await supabase.auth.getSession();
      const uid = atual.session?.user?.id ?? "";
      const tokenDoLink = uid
        ? tokenEntradaPeloLinkUnico(uid) ?? tokenAplicativoMotoristaGuardado()
        : tokenAplicativoMotoristaGuardado();
      try {
        clearAuthStartedAt();
        await supabase.auth.signOut({ scope: noMiniPainel ? "local" : "global" });
      } catch {
        // mesmo se falhar, garantimos redirecionamento
      }

      navigate(
        noMiniPainel
          ? tokenDoLink
            ? `/frota/acesso/${encodeURIComponent(tokenDoLink)}`
            : "/aplicativo-motorista"
          : "/login",
        { replace: true },
      );
    };

    const checkOnce = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        expiredHandledRef.current = false;
        clearAuthStartedAt();
        return;
      }

      const startedAt = readAuthStartedAt();
      if (!startedAt) {
        // Melhor esforço: se não temos a marca do "momento de autenticação",
        // iniciamos a contagem agora para evitar logoff prematuro.
        setAuthStartedAt(Date.now());
        expiredHandledRef.current = false;
        return;
      }

      if (isAuthExpired(startedAt)) {
        await handleExpiry();
      } else {
        expiredHandledRef.current = false;
      }
    };

    void checkOnce();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_IN") {
        expiredHandledRef.current = false;
        setAuthStartedAt(Date.now());
      }
      if (event === "SIGNED_OUT") {
        expiredHandledRef.current = false;
        clearAuthStartedAt();
      }

      // Se a sessão ainda existe, validamos rápido (evita "janela" até o tick do intervalo)
      if (session?.user && (event === "TOKEN_REFRESHED" || event === "SIGNED_IN")) {
        void checkOnce();
      }
    });

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void checkOnce();
    }, CHECK_EVERY_MS);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [navigate]);

  return null;
}

