import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      try {
        setNeedsMfa(false);
        const { data: assuranceData, error: assuranceErr } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        const shouldChallenge =
          !assuranceErr &&
          assuranceData?.nextLevel === "aal2" &&
          assuranceData?.currentLevel !== "aal2";

        if (shouldChallenge) {
          setNeedsMfa(true);
          setAuthorized(false);
          setLoading(false);
          return;
        }
      } catch {
        // Se falhar a verificação de AAL, não bloqueamos o fluxo.
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin_master")
        .maybeSingle();

      setAuthorized(!!data);
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
