import { useCallback, useEffect, useState } from "react";
import { Cloud, HardDrive, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type BackupStatus = {
  user_id: string;
  enabled: boolean;
  last_run_at: string | null;
  last_run_date_sp: string | null;
  last_status: string | null;
  last_error: string | null;
  last_prefix: string | null;
  last_stats: Record<string, unknown> | null;
};

function formatAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso;
  }
}

function statusBadge(status: string | null) {
  const s = (status || "").toLowerCase();
  if (s === "ok") {
    return (
      <Badge className="border-emerald-600/40 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/20">
        Copiado
      </Badge>
    );
  }
  if (s === "running") {
    return (
      <Badge className="border-sky-600/40 bg-sky-600/20 text-sky-300 hover:bg-sky-600/20">
        A copiar…
      </Badge>
    );
  }
  if (s === "error") {
    return (
      <Badge variant="destructive" className="border-destructive/40">
        Erro
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Ainda sem cópia
    </Badge>
  );
}

export default function R2AutoBackupSection() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);

  const loadStatus = useCallback(async () => {
    const { data, error } = await supabase.from("r2_auto_backup_status" as never).select("*").maybeSingle();
    if (error) {
      console.warn("r2_auto_backup_status:", error.message);
      setStatus(null);
      return;
    }
    setStatus((data as BackupStatus | null) ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await loadStatus();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadStatus]);

  const runBackup = async (quiet = false) => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        ok?: boolean;
        error?: string | null;
        prefix?: string;
      }>("r2-auto-backup", { body: { mode: "manual" } });
      if (error) throw new Error(error.message);
      if (data?.ok === false) throw new Error(data.error || "Falha no backup.");
      if (!quiet) toast.success("Cópia de segurança enviada para o R2.");
      await loadStatus();
    } catch (e) {
      if (!quiet) toast.error(e instanceof Error ? e.message : "Falha no backup.");
    } finally {
      setRunning(false);
    }
  };

  const handleToggle = async (next: boolean) => {
    setToggling(true);
    try {
      const { error } = await supabase.rpc("set_r2_auto_backup" as never, { p_enabled: next } as never);
      if (error) throw new Error(error.message);
      toast.success(next ? "AUTO BACK-UP ligado. A primeira cópia vai começar agora." : "AUTO BACK-UP desligado. As pastas já copiadas no R2 mantêm-se.");
      await loadStatus();
      if (next) await runBackup(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar o AUTO BACK-UP.");
    } finally {
      setToggling(false);
    }
  };

  const enabled = Boolean(status?.enabled);

  return (
    <div className="max-w-2xl rounded-xl border border-border bg-card p-6">
      <div className="mb-1 flex items-center gap-2">
        <HardDrive className="h-5 w-5 text-[#FF6600]" />
        <h3 className="font-semibold text-foreground">AUTO BACK-UP</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Cópia diária só da <strong className="text-foreground">sua empresa</strong> para o Cloudflare R2. Cada dia gera uma
        pasta com a data (ex.: 19.09.26) dentro da pasta da empresa. Nada é apagado no painel nem misturado com outros
        utilizadores.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-muted/20 px-4 py-3">
            <div className="min-w-0">
              <Label htmlFor="auto-backup-r2" className="text-foreground">
                Activar AUTO BACK-UP
              </Label>
              <p className="text-xs text-muted-foreground">
                Envia Transfer, Grupos, Motoristas, Clientes, Veículos, Configurações e Anotações.
              </p>
            </div>
            <Switch
              id="auto-backup-r2"
              checked={enabled}
              disabled={toggling || running}
              onCheckedChange={(v) => void handleToggle(v)}
            />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            {statusBadge(status?.last_status ?? null)}
            <span className="text-muted-foreground">Última cópia: {formatAt(status?.last_run_at ?? null)}</span>
          </div>

          {status?.last_prefix ? (
            <p className="mb-4 break-all font-mono text-xs text-muted-foreground">
              Pasta no R2: {status.last_prefix}
            </p>
          ) : null}

          {status?.last_error ? (
            <p className="mb-4 text-sm text-destructive">{status.last_error}</p>
          ) : null}

          <div className={cn("flex flex-wrap gap-2")}>
            <Button
              type="button"
              className="bg-[#FF6600] text-white hover:bg-[#FF6600]/90"
              disabled={running || toggling}
              onClick={() => void runBackup(false)}
            >
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Cloud className="mr-2 h-4 w-4" />}
              Copiar agora
            </Button>
            <Button type="button" variant="outline" disabled={loading || running} onClick={() => void loadStatus()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Actualizar estado
            </Button>
          </div>

          <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6600]" />
            As pastas ficam privadas no R2 (não são públicas na internet). Dias anteriores não são substituídos.
          </p>
        </>
      )}
    </div>
  );
}
