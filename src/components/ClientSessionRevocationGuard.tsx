import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthStartedAt } from "@/lib/authExpiry";
import { isTabLeader, onTabLeaderChange } from "@/lib/tabLeader";
import { saidaDoMiniPainelEhLocal, tokenEntradaPeloLinkUnico } from "@/lib/motoristaPortalEntrada";
import { tokenAplicativoMotoristaGuardado } from "@/lib/capacitorFrota";
import {
  clearRevokeAck,
  fetchServerRevokedAtIso,
  readJwtIatMs,
  readJwtSessionId,
  readRevokeAckMs,
  setRevokeAckFromIso,
} from "@/lib/sessionRevocation";

const CHECK_EVERY_MS = 3 * 60 * 1000;
/** Folga relógio servidor vs `iat` do JWT (evita deslogar quem acabou de obter token). */
const JWT_IAT_SLACK_MS = 10_000;

export default function ClientSessionRevocationGuard() {
  const navigate = useNavigate();
  const revokeHandledRef = useRef(false);
  /** session_id do sign-in desta aba, enquanto o claim ainda não gravou no servidor. */
  const pendingOwnSidRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const handleRevoked = async () => {
      if (!mounted) return;
      if (revokeHandledRef.current) return;
      revokeHandledRef.current = true;

      const noMiniPainel = saidaDoMiniPainelEhLocal(window.location.pathname);
      const { data: atual } = await supabase.auth.getSession();
      const uid = atual.session?.user?.id ?? "";
      const tokenDoLink = uid
        ? tokenEntradaPeloLinkUnico(uid) ?? tokenAplicativoMotoristaGuardado()
        : tokenAplicativoMotoristaGuardado();
      try {
        clearAuthStartedAt();
        clearRevokeAck();
        await supabase.auth.signOut({ scope: noMiniPainel ? "local" : "global" });
      } catch {
        /* mesmo se falhar, redireccionamos */
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

    const syncAckFromServer = async (): Promise<void> => {
      const serverIso = await fetchServerRevokedAtIso();
      if (!mounted || !serverIso) return;
      setRevokeAckFromIso(serverIso);
    };

    const checkOnce = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        revokeHandledRef.current = false;
        return;
      }

      const tokenSid = readJwtSessionId(session.access_token);
      if (tokenSid) {
        const { data: activeRows, error: activeErr } = await supabase
          .from("user_active_sessions")
          .select("session_id")
          .eq("user_id", session.user.id);
        if (!mounted) return;
        const activeIds = (activeRows ?? []).map((row) => row.session_id).filter(Boolean);
        if (!activeErr && activeIds.length > 0 && !activeIds.includes(tokenSid)) {
          if (pendingOwnSidRef.current === tokenSid) return;
          await handleRevoked();
          return;
        }
        if (activeIds.includes(tokenSid)) pendingOwnSidRef.current = null;
      }

      const serverIso = await fetchServerRevokedAtIso();
      if (!mounted || !serverIso) return;

      const serverMs = Date.parse(serverIso);
      if (!Number.isFinite(serverMs)) return;

      const ackMs = readRevokeAckMs();
      if (ackMs == null) {
        const iatMs = readJwtIatMs(session.access_token);
        if (iatMs == null) {
          setRevokeAckFromIso(serverIso);
          revokeHandledRef.current = false;
          return;
        }
        if (serverMs > iatMs + JWT_IAT_SLACK_MS) {
          await handleRevoked();
        } else {
          setRevokeAckFromIso(serverIso);
          revokeHandledRef.current = false;
        }
        return;
      }

      if (serverMs > ackMs) {
        await handleRevoked();
      } else {
        revokeHandledRef.current = false;
      }
    };

    const tick = () => {
      if (!isTabLeader()) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void checkOnce();
    };

    tick();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_IN" && session?.user) {
        revokeHandledRef.current = false;
        pendingOwnSidRef.current = session.access_token ? readJwtSessionId(session.access_token) : null;
        if (isTabLeader()) void syncAckFromServer();
      }

      if (event === "SIGNED_OUT") {
        revokeHandledRef.current = false;
        pendingOwnSidRef.current = null;
        clearRevokeAck();
      }

      if (session?.user && (event === "TOKEN_REFRESHED" || event === "SIGNED_IN")) {
        tick();
      }
    });

    const interval = window.setInterval(tick, CHECK_EVERY_MS);
    const unsubLeader = onTabLeaderChange((leader) => {
      if (leader) tick();
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      unsubLeader();
      document.removeEventListener("visibilitychange", onVisible);
      subscription.unsubscribe();
    };
  }, [navigate]);

  return null;
}
