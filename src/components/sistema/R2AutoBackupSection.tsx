import { useCallback, useEffect, useState } from "react";
import { Cloud, HardDrive, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { runInitialR2Snapshot } from "@/lib/r2Registro";

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

  const runInitial = async () => {
    setRunning(true);
    try {
      await runInitialR2Snapshot((label) => {
        toast.message(label, { id: "r2-snapshot" });
      });
      toast.success("Cópia inicial concluída. Daqui pra frente só o que você salvar ou excluir é enviado.", { id: "r2-snapshot" });
      await loadStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na cópia inicial.", { id: "r2-snapshot" });
      await loadStatus();
    } finally {
      setRunning(false);
    }
  };

  const handleToggle = async (next: boolean) => {
    setToggling(true);
    try {
      const { error } = await supabase.rpc("set_r2_auto_backup" as never, { p_enabled: next } as never);
      if (error) throw new Error(error.message);
      toast.success(next ? "Registro ligado. Faça a cópia inicial uma vez. Depois, só cada salvamento é enviado." : "Registro desligado. O que já está na Cloudflare permanece.");
      await loadStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar o AUTO BACK-UP.");
    } finally {
      setToggling(false);
    }
  };

  const enabled = Boolean(status?.enabled);
  const snapshotDone = Boolean(
    status?.last_stats && typeof status.last_stats.snapshot_completed_at === "string" && status.last_stats.snapshot_completed_at,
  );

  return (
    <div className="max-w-2xl rounded-xl border border-border bg-card p-6">
      <div className="mb-1 flex items-center gap-2">
        <HardDrive className="h-5 w-5 text-[#FF6600]" />
        <h3 className="font-semibold text-foreground">Registro na Cloudflare</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        A <strong className="text-foreground">cópia inicial</strong> envia os dados que já existem, um arquivo por
        registro. Depois disso, cadastrar ou clicar em salvar regrava só aquele registro. Excluir apaga só o arquivo
        dele. Abrir o painel sem alterar nada não envia arquivo.
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
                Ativar registro
              </Label>
              <p className="text-xs text-muted-foreground">
                Veículos, motoristas, clientes, reservas, financeiro, contratos, automações, receptivos, anotações e configurações.
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
              disabled={!enabled || running || toggling || snapshotDone}
              onClick={() => void runInitial()}
            >
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Cloud className="mr-2 h-4 w-4" />}
              {snapshotDone ? "Cópia inicial já feita" : "Fazer cópia inicial"}
            </Button>
            <Button type="button" variant="outline" disabled={loading || running} onClick={() => void loadStatus()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Actualizar estado
            </Button>
          </div>

          <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6600]" />
            Cada registro fica num arquivo próprio e privado. A pasta antiga por data não é apagada. Salvar de novo substitui só o arquivo daquele registro.
          </p>
        </>
      )}
    </div>
  );
}
