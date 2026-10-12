import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isMotoristaFrotaUser, userIsMotoristaFrotaFromMetadata } from "@/lib/motoristaFrotaRole";
import { entradaDoPortalEstaValida, limparEntradaPeloLinkUnico, MSG_MINI_PAINEL_SO_PELO_LINK } from "@/lib/motoristaPortalEntrada";
import { getPostLoginPath } from "@/lib/sessionRole";
import { clearAuthStartedAt, isAuthExpired, readAuthStartedAt, setAuthStartedAt } from "@/lib/authExpiry";
import AuthBootScreen from "@/components/AuthBootScreen";

function AvisoSomenteLink() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-3 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-lg font-semibold">Mini painel do motorista</h1>
        <p className="text-sm text-muted-foreground">{MSG_MINI_PAINEL_SO_PELO_LINK}</p>
      </div>
    </div>
  );
}

/**
 * Painel mínimo motorista da frota (/frota).
 * Só abre depois da confirmação do link exclusivo /frota/acesso/:token.
 */
export default function ProtectedFrotaRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);
  const [somenteLink, setSomenteLink] = useState(false);
  const [outroPainel, setOutroPainel] = useState<"/admin" | "/dashboard" | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session) {
        setOk(false);
        setSomenteLink(true);
        setOutroPainel(null);
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
        setSomenteLink(true);
        setOutroPainel(null);
        setLoading(false);
        return;
      }

      const ehMotorista =
        userIsMotoristaFrotaFromMetadata(session.user) ||
        (await isMotoristaFrotaUser(session.user.id, session.user));
      if (!mounted) return;

      if (ehMotorista) {
        const peloLink = await entradaDoPortalEstaValida(session.user.id);
        if (!mounted) return;
        if (peloLink) {
          setOk(true);
          setSomenteLink(false);
          setOutroPainel(null);
          setLoading(false);
          return;
        }
        limparEntradaPeloLinkUnico();
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          /* sem o link exclusivo o mini painel não permanece aberto */
        }
        if (!mounted) return;
        setOk(false);
        setSomenteLink(true);
        setOutroPainel(null);
        setLoading(false);
        return;
      }

      const path = await getPostLoginPath(session.user.id, session.user);
      if (!mounted) return;
      setOk(false);
      setSomenteLink(false);
      setOutroPainel(path === "/admin" || path === "/dashboard" ? path : "/dashboard");
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

  if (somenteLink) return <AvisoSomenteLink />;
  if (outroPainel) return <Navigate to={outroPainel} replace />;
  if (!ok) return <AvisoSomenteLink />;
  return <>{children}</>;
}
