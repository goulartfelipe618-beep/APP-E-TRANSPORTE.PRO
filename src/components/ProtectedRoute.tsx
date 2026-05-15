import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthStartedAt, isAuthExpired, readAuthStartedAt, setAuthStartedAt } from "@/lib/authExpiry";
import { isMotoristaFrotaUser } from "@/lib/motoristaFrotaRole";
import { sessionRequiresMfaTotpChallenge } from "@/lib/mfaGate";

/**
 * Rotas autenticadas do painel (motorista executivo). O JWT é gerido pelo cliente Supabase
 * com PKCE + sessionStorage e autoRefreshToken (ver `integrations/supabase/client.ts`).
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [redirectFrota, setRedirectFrota] = useState(false);

  useEffect(() => {
    let mounted = true;
    /** Fila única — evita dezenas de `getSession` em paralelo (contenção no lock interno do auth-js). */
    let queue = Promise.resolve();

    const check = async (opts?: { withSpinner?: boolean }) => {
      const withSpinner = opts?.withSpinner === true;
      if (withSpinner) setLoading(true);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (!session) {
          setAuthenticated(false);
          setNeedsMfa(false);
          setLoading(false);
          return;
        }

        const startedAt = readAuthStartedAt();
        if (!startedAt) setAuthStartedAt(Date.now());
        if (startedAt && isAuthExpired(startedAt)) {
          clearAuthStartedAt();
          try {
            await supabase.auth.signOut();
          } catch {
            // ignore
          }
          setAuthenticated(false);
          setNeedsMfa(false);
          setLoading(false);
          return;
        }

        const frota = await isMotoristaFrotaUser(session.user.id);
        if (frota) {
          setRedirectFrota(true);
          setNeedsMfa(false);
          setAuthenticated(false);
          setLoading(false);
          return;
        }

        const shouldChallenge = await sessionRequiresMfaTotpChallenge(supabase);
        setNeedsMfa(shouldChallenge);
        setAuthenticated(true);
      } catch {
        if (!mounted) return;
        setAuthenticated(false);
        setNeedsMfa(false);
        setRedirectFrota(false);
        setLoading(false);
      } finally {
        if (mounted && withSpinner) setLoading(false);
      }
    };

    const enqueueCheck = (opts?: { withSpinner?: boolean }) => {
      queue = queue
        .then(async () => {
          if (!mounted) return;
          await check(opts);
        })
        .catch(() => {
          /* evita rebentar a cadeia; falhas auth tratadas dentro de check */
        });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (!mounted) return;
      // Sem withSpinner: TOKEN_REFRESHED / INITIAL_SESSION ao focar a aba não desmontam o layout (evita voltar ao Home).
      enqueueCheck();
    });

    enqueueCheck({ withSpinner: true });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (redirectFrota) return <Navigate to="/frota" replace />;
  if (needsMfa) return <Navigate to="/mfa" replace />;
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
