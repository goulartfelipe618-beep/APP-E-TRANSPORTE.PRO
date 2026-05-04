import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getPostLoginPath } from "@/lib/sessionRole";
import { clearAuthStartedAt, isAuthExpired, readAuthStartedAt, setAuthStartedAt } from "@/lib/authExpiry";
import { sessionRequiresMfaTotpChallenge } from "@/lib/mfaGate";

export default function ProtectedTaxiRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAuthorized(false);
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
        setAuthorized(false);
        setNeedsMfa(false);
        setLoading(false);
        return;
      }

      const shouldChallenge = await sessionRequiresMfaTotpChallenge(supabase);
      if (shouldChallenge) {
        setNeedsMfa(true);
        setAuthorized(false);
        setLoading(false);
        return;
      }

      const path = await getPostLoginPath(session.user.id);
      setAuthorized(path === "/taxi");
      setLoading(false);
    };

    void checkAccess();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void checkAccess();
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (needsMfa) return <Navigate to="/mfa" replace />;
  if (!authorized) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
