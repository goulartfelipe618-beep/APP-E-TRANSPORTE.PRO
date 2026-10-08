import { useCallback, useEffect, useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type GmailStatus = { connected: boolean; email: string | null };

export default function EmailPage() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [busy, setBusy] = useState<"connect" | "disconnect" | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("gmail-oauth", { body: { action: "status" } });
    if (error || !data?.ok) {
      setStatus({ connected: false, email: null });
      return;
    }
    setStatus({ connected: Boolean(data.connected), email: data.email ?? null });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const conectar = async () => {
    setBusy("connect");
    const { data, error } = await supabase.functions.invoke("gmail-oauth", {
      body: { action: "start", returnTo: `${window.location.origin}/dashboard` },
    });
    if (error || !data?.ok || !data.url) {
      toast.error(data?.error || "Não foi possível abrir o Gmail.");
      setBusy(null);
      return;
    }
    window.location.assign(data.url);
  };

  const desconectar = async () => {
    setBusy("disconnect");
    const { data, error } = await supabase.functions.invoke("gmail-oauth", { body: { action: "disconnect" } });
    setBusy(null);
    if (error || !data?.ok) {
      toast.error("Não foi possível desconectar o Gmail.");
      return;
    }
    setStatus({ connected: false, email: null });
    toast.success("Gmail desconectado.");
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">E-mail</h1>
        <p className="mt-1 text-sm text-muted-foreground">Conecte o Gmail desta operação.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-foreground">
          <Mail className="h-6 w-6" />
        </div>
        {status === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : status.connected && status.email ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Conta conectada</p>
            <p className="break-all text-base font-medium text-foreground">{status.email}</p>
            <Button variant="outline" onClick={() => void desconectar()} disabled={busy !== null}>
              {busy === "disconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Desconectar
            </Button>
          </div>
        ) : (
          <Button onClick={() => void conectar()} disabled={busy !== null} className="bg-[#FF6600] text-white hover:bg-[#FF6600]/90">
            {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Conectar Gmail
          </Button>
        )}
      </div>
    </div>
  );
}
