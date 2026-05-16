import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getPostLoginPath } from "@/lib/sessionRole";
import { clearAuthStartedAt, isAuthExpired, readAuthStartedAt, setAuthStartedAt } from "@/lib/authExpiry";
import { sessionRequiresMfaTotpChallenge } from "@/lib/mfaGate";

export default function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

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

      const path = await getPostLoginPath(session.user.id, session.user);
      setAuthorized(path === "/admin");
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { check(); });
    check();
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
