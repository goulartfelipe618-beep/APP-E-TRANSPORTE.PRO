import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAuthenticated(false);
        setNeedsMfa(false);
        setLoading(false);
        return;
      }

      try {
        const { data: assuranceData, error: assuranceErr } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        const shouldChallenge =
          !assuranceErr &&
          assuranceData?.nextLevel === "aal2" &&
          assuranceData?.currentLevel !== "aal2";

        setNeedsMfa(!!shouldChallenge);
        setAuthenticated(true);
      } catch {
        // Sem erro de MFA, seguimos apenas com autenticação.
        setNeedsMfa(false);
        setAuthenticated(true);
      } finally {
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      check();
    });

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
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
