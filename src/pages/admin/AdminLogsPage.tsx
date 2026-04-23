import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  Trash2,
  ChevronDown,
  MonitorSmartphone,
  User,
  MapPin,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type LogRow = Tables<"painel_client_error_logs">;

const QUERY_KEY = ["admin-painel-client-error-logs"] as const;

const PAINEL_LABEL: Record<string, string> = {
  motorista_executivo: "Motorista executivo",
  admin_master: "Admin Master",
  taxi: "Táxi",
};

const KIND_LABEL: Record<string, string> = {
  error: "Erro JS",
  unhandledrejection: "Promise rejeitada",
  react_boundary: "React (boundary)",
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

export default function AdminLogsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [masterAccess, setMasterAccess] = useState<"pending" | "yes" | "no">("pending");
  const [painelFilter, setPainelFilter] = useState<string>("all");
  const [nomeFilter, setNomeFilter] = useState("");
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user?.id) {
        setMasterAccess("no");
        navigate("/", { replace: true });
        return;
      }
      const { data, error } = await supabase.rpc("is_admin_master", { _user_id: user.id });
      if (cancelled) return;
      if (error || !Boolean(data)) {
        setMasterAccess("no");
        navigate("/", { replace: true });
        return;
      }
      setMasterAccess("yes");
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const query = useQuery({
    queryKey: [...QUERY_KEY, painelFilter],
    enabled: masterAccess === "yes",
    queryFn: async () => {
      let q = supabase
        .from("painel_client_error_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(400);
      if (painelFilter !== "all") {
        q = q.eq("painel", painelFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const filtered = useMemo(() => {
    const rows = query.data ?? [];
    const n = nomeFilter.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter((r) => {
      const name = (r.user_display_name ?? "").toLowerCase();
      const email = (r.user_email ?? "").toLowerCase();
      return name.includes(n) || email.includes(n);
    });
  }, [query.data, nomeFilter]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY] });
  }, [queryClient]);

  useEffect(() => {
    if (masterAccess !== "yes") return;
    const channel = supabase
      .channel("admin-painel-error-logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "painel_client_error_logs" },
        () => {
          invalidate();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [invalidate, masterAccess]);

  const handlePurgeOld = async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const iso = cutoff.toISOString();
    setPurging(true);
    try {
      const { error } = await supabase.from("painel_client_error_logs").delete().lt("created_at", iso);
      if (error) throw error;
      toast.success(`Registos anteriores a ${formatWhen(iso)} foram eliminados.`);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao eliminar.");
    } finally {
      setPurging(false);
    }
  };

  if (masterAccess === "pending") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin shrink-0" aria-hidden />
        A verificar permissões…
      </div>
    );
  }

  if (masterAccess === "no") {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Logs do painel</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-3xl">
          Erros e rejeições capturados nos browsers (motorista executivo, táxi e Admin Master). Consulta
          exclusiva do administrador master; a tabela <code className="text-xs">painel_client_error_logs</code>{" "}
          aplica RLS no Supabase.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1.5 min-w-[200px]">
          <span className="text-xs font-medium text-muted-foreground">Painel</span>
          <Select value={painelFilter} onValueChange={setPainelFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os painéis</SelectItem>
              <SelectItem value="motorista_executivo">Motorista executivo</SelectItem>
              <SelectItem value="taxi">Táxi</SelectItem>
              <SelectItem value="admin_master">Admin Master</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 flex-1 min-w-[200px]">
          <span className="text-xs font-medium text-muted-foreground">Nome ou e-mail</span>
          <Input
            placeholder="Filtrar por motorista / utilizador…"
            value={nomeFilter}
            onChange={(e) => setNomeFilter(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => invalidate()}
            disabled={query.isFetching}
            title="Atualizar"
          >
            <RefreshCw className={cn("h-4 w-4", query.isFetching && "animate-spin")} />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={purging}
            onClick={() => void handlePurgeOld()}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar &gt; 30 dias
          </Button>
        </div>
      </div>

      {query.isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex gap-2 items-start">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Não foi possível carregar os logs.</p>
            <p className="text-destructive/90 mt-1">
              {query.error instanceof Error ? query.error.message : String(query.error)}
            </p>
            <p className="mt-2 text-xs text-destructive/80">
              Confirme que aplicou a migration e que a sessão é de admin_master (RLS).
            </p>
          </div>
        </div>
      )}

      {query.isLoading && (
        <p className="text-sm text-muted-foreground">A carregar…</p>
      )}

      {!query.isLoading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sem registos. Os erros só aparecem depois de um utilizador autenticado gerar um evento com o
          reporter activo nos painéis.
        </p>
      )}

      <div className="space-y-3">
        {filtered.map((row) => (
          <Collapsible key={row.id} className="group rounded-xl border border-border bg-card overflow-hidden">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent/40 transition-colors"
              >
                <ChevronDown className="h-4 w-4 shrink-0 mt-1 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {PAINEL_LABEL[row.painel] ?? row.painel}
                    </Badge>
                    <Badge className="text-[10px] bg-[#FF6600] text-white hover:bg-[#FF6600]/90">
                      {KIND_LABEL[row.kind] ?? row.kind}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatWhen(row.created_at)}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground break-words">{row.message}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="font-medium text-foreground">
                        {row.user_display_name?.trim() || "—"}
                      </span>
                      {row.user_email ? <span>({row.user_email})</span> : null}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      Menu: <span className="font-mono text-foreground">{row.active_page || "—"}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MonitorSmartphone className="h-3 w-3 shrink-0" />
                      Rota: <span className="font-mono text-foreground">{row.route_path || "—"}</span>
                    </span>
                  </div>
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/20">
                <div className="text-[11px] text-muted-foreground font-mono break-all">
                  user_id: {row.user_id}
                </div>
                {row.user_agent && (
                  <div>
                    <p className="text-[11px] font-semibold text-foreground mb-1">User-Agent</p>
                    <pre className="text-[11px] whitespace-pre-wrap break-words text-muted-foreground max-h-24 overflow-y-auto rounded-md border border-border bg-background p-2">
                      {row.user_agent}
                    </pre>
                  </div>
                )}
                {row.stack && (
                  <div>
                    <p className="text-[11px] font-semibold text-foreground mb-1">Stack</p>
                    <pre className="text-[11px] whitespace-pre-wrap break-words text-muted-foreground max-h-48 overflow-y-auto rounded-md border border-border bg-background p-2">
                      {row.stack}
                    </pre>
                  </div>
                )}
                {row.component_stack && (
                  <div>
                    <p className="text-[11px] font-semibold text-foreground mb-1">Component stack (React)</p>
                    <pre className="text-[11px] whitespace-pre-wrap break-words text-muted-foreground max-h-48 overflow-y-auto rounded-md border border-border bg-background p-2">
                      {row.component_stack}
                    </pre>
                  </div>
                )}
                <div>
                  <p className="text-[11px] font-semibold text-foreground mb-1">Extra (JSON)</p>
                  <pre className="text-[11px] whitespace-pre-wrap break-words text-muted-foreground max-h-40 overflow-y-auto rounded-md border border-border bg-background p-2">
                    {JSON.stringify(row.extra ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
