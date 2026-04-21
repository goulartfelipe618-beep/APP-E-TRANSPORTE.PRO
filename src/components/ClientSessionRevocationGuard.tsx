import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthStartedAt } from "@/lib/authExpiry";
import {
  clearRevokeAck,
  fetchServerRevokedAtIso,
  readJwtIatMs,
  readRevokeAckMs,
  setRevokeAckFromIso,
} from "@/lib/sessionRevocation";

const CHECK_EVERY_MS = 60 * 1000;
/** Folga relógio servidor vs `iat` do JWT (evita deslogar quem acabou de obter token). */
const JWT_IAT_SLACK_MS = 10_000;

export default function ClientSessionRevocationGuard() {
  const navigate = useNavigate();
  const revokeHandledRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const handleRevoked = async () => {
      if (!mounted) return;
      if (revokeHandledRef.current) return;
      revokeHandledRef.current = true;

      try {
        clearAuthStartedAt();
        clearRevokeAck();
        await supabase.auth.signOut();
      } catch {
        /* mesmo se falhar, redireccionamos */
      }

      navigate("/login", { replace: true });
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

    void checkOnce();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_IN" && session?.user) {
        revokeHandledRef.current = false;
        void syncAckFromServer();
      }

      if (event === "SIGNED_OUT") {
        revokeHandledRef.current = false;
        clearRevokeAck();
      }

      if (session?.user && (event === "TOKEN_REFRESHED" || event === "SIGNED_IN")) {
        void checkOnce();
      }
    });

    const interval = window.setInterval(() => {
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
