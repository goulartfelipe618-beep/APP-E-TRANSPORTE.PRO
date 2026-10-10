import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isMotoristaFrotaUser, userIsMotoristaFrotaFromMetadata } from "@/lib/motoristaFrotaRole";
import { clearAuthStartedAt, isAuthExpired, readAuthStartedAt, setAuthStartedAt } from "@/lib/authExpiry";
import AuthBootScreen from "@/components/AuthBootScreen";

/**
 * Painel mínimo motorista da frota (/frota). Só utilizadores com portal_auth_user_id na ficha.
 */
export default function ProtectedFrotaRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session) {
        setOk(false);
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
          /* ignore */
        }
        setOk(false);
        setLoading(false);
        return;
      }

      if (userIsMotoristaFrotaFromMetadata(session.user)) {
        if (!mounted) return;
        setOk(true);
        setLoading(false);
        return;
      }

      const frota = await isMotoristaFrotaUser(session.user.id, session.user);
      if (!mounted) return;
      setOk(frota);
      setLoading(false);
    };

    void run();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void run();
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <AuthBootScreen />;
  }

  if (!ok) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
