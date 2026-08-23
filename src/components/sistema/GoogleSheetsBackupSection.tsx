import { useCallback, useEffect, useState } from "react";
import {
  FileSpreadsheet,
  Cloud,
  Link2,
  Unlink,
  RefreshCw,
  Loader2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SheetsStatus = {
  user_id: string;
  google_email: string | null;
  spreadsheet_id: string | null;
  spreadsheet_url: string | null;
  auto_sync_enabled: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  last_sync_stats: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

function formatSyncAt(iso: string | null): string {
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
      <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/40 hover:bg-emerald-600/20">
        Sincronizado
      </Badge>
    );
  }
  if (s === "running") {
    return (
      <Badge className="bg-sky-600/20 text-sky-300 border-sky-600/40 hover:bg-sky-600/20">
        A sincronizar…
      </Badge>
    );
  }
  if (s === "partial") {
    return (
      <Badge className="bg-amber-600/20 text-amber-300 border-amber-600/40 hover:bg-amber-600/20">
        Parcial
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
      Sem sync
    </Badge>
  );
}

/**
 * Integração Google Sheets — só painel da empresa (dashboard / admin_transfer).
 * Tokens nunca passam pelo browser; OAuth e sync via Edge Functions.
 */
export default function GoogleSheetsBackupSection() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SheetsStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [togglingAuto, setTogglingAuto] = useState(false);

  const loadStatus = useCallback(async () => {
    const { data, error } = await supabase
      .from("google_sheets_backup_status" as never)
      .select("*")
      .maybeSingle();

    if (error) {
      // View ainda não aplicada no projeto remoto — UI continua utilizável
      console.warn("google_sheets_backup_status:", error.message);
      setStatus(null);
    } else {
      setStatus((data as SheetsStatus | null) ?? null);
    }
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_sheets") === "connected") {
      toast.success("Google Sheets ligado com sucesso.");
      void loadStatus();
      params.delete("google_sheets");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", next);
    }
  }, [loadStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ authUrl?: string; error?: string }>(
        "google-sheets-oauth-start",
        { body: {} },
      );
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.authUrl) throw new Error("URL de autorização em falta.");
      window.location.href = data.authUrl;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg.includes("Secrets Google") ? "Google API ainda não configurada na plataforma." : msg);
      setConnecting(false);
    }
  };

  const handleBackupNow = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        ok?: boolean;
        error?: string | null;
        stats?: Record<string, unknown>;
      }>("google-sheets-backup-run", { body: { mode: "manual" } });

      if (error) throw new Error(error.message);
      if (data?.error && data.ok === false) {
        toast.error(data.error);
      } else if (data?.ok === false) {
        toast.error(data.error || "Backup concluído com erros.");
      } else {
        toast.success("Backup enviado para o Google Sheets.");
      }
      await loadStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no backup.");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Desligar Google Sheets? A planilha existente permanece na sua conta Google.")) {
      return;
    }
    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
        "google-sheets-oauth-disconnect",
        { body: {} },
      );
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setStatus(null);
      toast.success("Google Sheets desligado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível desligar.");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleToggleAuto = async (enabled: boolean) => {
    setTogglingAuto(true);
    try {
      const { data, error } = await supabase.rpc("set_google_sheets_auto_sync" as never, {
        p_enabled: enabled,
      } as never);
      if (error) throw new Error(error.message);
      if (data === false) {
        toast.error("Ligue o Google Sheets antes de activar o backup automático.");
        return;
      }
      setStatus((prev) => (prev ? { ...prev, auto_sync_enabled: enabled } : prev));
      toast.success(enabled ? "Backup automático diário activado." : "Backup automático desactivado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar o automático.");
    } finally {
      setTogglingAuto(false);
    }
  };

  const connected = Boolean(status?.spreadsheet_id);

  return (
    <div className="rounded-xl border border-border bg-card p-6 max-w-2xl overflow-hidden relative">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#FF6600]/80 via-[#FF6600]/40 to-transparent"
        aria-hidden
      />

      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FF6600]/15 border border-[#FF6600]/30">
            <FileSpreadsheet className="h-5 w-5 text-[#FF6600]" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground flex items-center gap-2 flex-wrap">
              Integração Google Sheets
              {connected ? (
                <Badge className="bg-[#FF6600]/15 text-[#FF6600] border-[#FF6600]/40 hover:bg-[#FF6600]/15">
                  Ligado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Desligado
                </Badge>
              )}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Backup automático de reservas, motoristas, veículos, clientes, financeiro e mais.
            </p>
          </div>
        </div>
        <Cloud className="h-5 w-5 text-muted-foreground shrink-0 hidden sm:block" />
      </div>

      <div className="mt-4 rounded-lg border border-border/80 bg-muted/30 p-3 flex gap-2 text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-[#FF6600]" />
        <p>
          A plataforma usa uma conta Google Cloud API (OAuth). A sua empresa autoriza a{" "}
          <strong className="text-foreground font-medium">própria conta Google</strong>; os tokens
          ficam só no servidor. Cada sync reescreve as abas da planilha com os dados actuais do
          sistema.
        </p>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar estado…
        </div>
      ) : !connected ? (
        <div className="mt-6 space-y-4">
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
            <li>Cria uma planilha «E-Transporte Backup» na sua Drive</li>
            <li>Exporta transfer, grupos, frota, clientes, financeiro, etc.</li>
            <li>Permite backup manual e automático diário</li>
          </ul>
          <Button
            onClick={() => void handleConnect()}
            disabled={connecting}
            className="bg-[#FF6600] hover:bg-[#e65c00] text-white"
          >
            {connecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> A redirecionar…
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" /> Conectar com Google
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1">Conta Google</p>
              <p className="text-sm font-medium text-foreground truncate">
                {status?.google_email || "—"}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1">Última sincronização</p>
              <div className="flex items-center gap-2 flex-wrap">
                {statusBadge(status?.last_sync_status ?? null)}
                <span className="text-sm text-foreground">{formatSyncAt(status?.last_sync_at ?? null)}</span>
              </div>
            </div>
          </div>

          {status?.last_sync_error ? (
            <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{status.last_sync_error}</span>
            </div>
          ) : status?.last_sync_status === "ok" ? (
            <div className="flex gap-2 rounded-lg border border-emerald-600/30 bg-emerald-600/10 p-3 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Planilha actualizada com os dados do sistema.</span>
            </div>
          ) : null}

          {status?.spreadsheet_url ? (
            <a
              href={status.spreadsheet_url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center gap-2 text-sm font-medium text-[#FF6600] hover:underline",
              )}
            >
              Abrir planilha no Google Sheets <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <Label htmlFor="gsheets-auto" className="text-foreground">
                Backup automático diário
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Actualiza a planilha todos os dias (quando o agendamento estiver activo no servidor).
              </p>
            </div>
            <Switch
              id="gsheets-auto"
              checked={Boolean(status?.auto_sync_enabled)}
              disabled={togglingAuto}
              onCheckedChange={(v) => void handleToggleAuto(v)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void handleBackupNow()}
              disabled={syncing || disconnecting}
              className="bg-[#FF6600] hover:bg-[#e65c00] text-white"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> A sincronizar…
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" /> Backup agora
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleDisconnect()}
              disabled={syncing || disconnecting}
            >
              {disconnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> A desligar…
                </>
              ) : (
                <>
                  <Unlink className="h-4 w-4 mr-2" /> Desconectar
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
