import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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
        // Ignora problemas de verificação de AAL e segue fluxo de role.
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin_taxi")
        .maybeSingle();

      setAuthorized(!!roleData);
      setLoading(false);
    };

    checkAccess();
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
