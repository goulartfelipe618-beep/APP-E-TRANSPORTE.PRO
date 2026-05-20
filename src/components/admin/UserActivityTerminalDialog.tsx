import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw, Terminal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchUserActivityLogs, formatUserActivityTerminalLine } from "@/lib/userActivityLog";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userEmail: string | null;
};

export default function UserActivityTerminalDialog({ open, onOpenChange, userId, userEmail }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchUserActivityLogs(userId);
      setLines(rows.map((r) => formatUserActivityTerminalLine(r.created_at, r.message)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar atividades.";
      setError(msg);
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open && userId) void load();
  }, [open, userId, load]);

  const terminalBody = useMemo(() => {
    if (loading) return ["> A carregar stream de atividades…"];
    if (error) return [`> ERRO: ${error}`, "> Confirme que a migration user_activity_log foi aplicada no Supabase."];
    if (lines.length === 0) {
      return [
        "> Nenhuma atividade registada ainda.",
        "> As ações no painel Motorista Executivo aparecem aqui automaticamente.",
      ];
    }
    return lines;
  }, [loading, error, lines]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Terminal className="h-5 w-5 text-[#FF6600]" />
            Atividades do utilizador
          </DialogTitle>
          <DialogDescription>
            Linha do tempo em tempo real das ações no painel{" "}
            <strong className="text-foreground">Motorista Executivo</strong>
            {userEmail ? (
              <>
                {" "}
                — <span className="font-mono text-xs">{userEmail}</span>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            etp-activity-stream
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading || !userId}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        <div className="rounded-lg border border-zinc-800 overflow-hidden shadow-inner">
          <div className="flex items-center gap-1.5 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/90" />
            <span className="ml-2 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">activity.log</span>
            <Activity className="ml-auto h-3.5 w-3.5 text-[#FF6600]/80" />
          </div>
          <ScrollArea className="h-[min(60vh,420px)] bg-black">
            <pre className="p-4 font-mono text-[13px] leading-relaxed text-emerald-400/95 whitespace-pre-wrap break-words">
              {terminalBody.map((line, i) => (
                <div key={`${i}-${line.slice(0, 24)}`} className="hover:bg-zinc-900/40">
                  {line}
                </div>
              ))}
            </pre>
          </ScrollArea>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Portal de motoristas cadastrados (link /frota) não gera entradas neste registo.
        </p>
      </DialogContent>
    </Dialog>
  );
}
