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
  Shield,
  KeyRound,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type LogRow = Tables<"painel_client_error_logs">;
type LoginFailRow = Tables<"auth_login_failure_events">;
type AuditRow = Tables<"admin_audit_log">;

const QUERY_KEY_ERRORS = ["admin-painel-client-error-logs"] as const;
const QUERY_KEY_LOGIN = ["admin-auth-login-failure-events"] as const;
const QUERY_KEY_AUDIT = ["admin-audit-log"] as const;

const PAINEL_LABEL: Record<string, string> = {
  motorista_executivo: "Motorista executivo",
  admin_master: "Admin Master",
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
  const [tab, setTab] = useState("errors");

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

  const queryErrors = useQuery({
    queryKey: [...QUERY_KEY_ERRORS, painelFilter],
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

  const queryLoginFails = useQuery({
    queryKey: QUERY_KEY_LOGIN,
    enabled: masterAccess === "yes",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auth_login_failure_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as LoginFailRow[];
    },
  });

  const queryAudit = useQuery({
    queryKey: QUERY_KEY_AUDIT,
    enabled: masterAccess === "yes",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const filtered = useMemo(() => {
    const rows = queryErrors.data ?? [];
    const n = nomeFilter.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter((r) => {
      const name = (r.user_display_name ?? "").toLowerCase();
      const email = (r.user_email ?? "").toLowerCase();
      return name.includes(n) || email.includes(n);
    });
  }, [queryErrors.data, nomeFilter]);

  const invalidateErrors = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY_ERRORS] });
  }, [queryClient]);

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY_ERRORS] });
    void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY_LOGIN] });
    void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY_AUDIT] });
  }, [queryClient]);

  useEffect(() => {
    if (masterAccess !== "yes") return;
    const ch1 = supabase
      .channel("admin-painel-error-logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "painel_client_error_logs" },
        () => {
          invalidateErrors();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch1);
    };
  }, [invalidateErrors, masterAccess]);

  const handlePurgeOld = async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const iso = cutoff.toISOString();
    setPurging(true);
    try {
      const { error } = await supabase.from("painel_client_error_logs").delete().lt("created_at", iso);
      if (error) throw error;
      toast.success(`Registos anteriores a ${formatWhen(iso)} foram eliminados.`);
      invalidateAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao eliminar.");
    } finally {
      setPurging(false);
    }
  };

  if (masterAccess === "pending") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
        A verificar permissões…
      </div>
    );
  }

  if (masterAccess === "no") {
    return null;
  }

  const query = queryErrors;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Logs do painel</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Erros de browser, tentativas de login falhadas (impressão digital do e-mail, sem texto em claro) e auditoria de
          mutações staff (triggers no Postgres). Consulta exclusiva do administrador master.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="errors" className="gap-1.5">
            <MonitorSmartphone className="h-4 w-4" /> Erros do cliente
          </TabsTrigger>
          <TabsTrigger value="login" className="gap-1.5">
            <KeyRound className="h-4 w-4" /> Login falhado
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5">
            <Shield className="h-4 w-4" /> Auditoria staff
          </TabsTrigger>
        </TabsList>

        <TabsContent value="errors" className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[200px] space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Painel</span>
              <Select value={painelFilter} onValueChange={setPainelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os painéis</SelectItem>
                  <SelectItem value="motorista_executivo">Motorista executivo</SelectItem>
                  <SelectItem value="admin_master">Admin Master</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px] flex-1 space-y-1.5">
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
                onClick={() => invalidateErrors()}
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
                <Trash2 className="mr-2 h-4 w-4" />
                Limpar erros &gt; 30 dias
              </Button>
            </div>
          </div>

          {query.isError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Não foi possível carregar os logs.</p>
                <p className="mt-1 text-destructive/90">
                  {query.error instanceof Error ? query.error.message : String(query.error)}
                </p>
                <p className="mt-2 text-xs text-destructive/80">
                  Confirme que aplicou a migration e que a sessão é de admin_master (RLS).
                </p>
              </div>
            </div>
          )}

          {query.isLoading && <p className="text-sm text-muted-foreground">A carregar…</p>}

          {!query.isLoading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sem registos. Os erros só aparecem depois de um utilizador autenticado gerar um evento com o reporter activo
              nos painéis.
            </p>
          )}

          <div className="space-y-3">
            {filtered.map((row) => (
              <Collapsible key={row.id} className="group overflow-hidden rounded-xl border border-border bg-card">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40"
                  >
                    <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
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
                      <p className="break-words text-sm font-medium text-foreground">{row.message}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="font-medium text-foreground">{row.user_display_name?.trim() || "—"}</span>
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
                  <div className="space-y-3 border-t border-border bg-muted/20 px-4 py-3">
                    <div className="break-all font-mono text-[11px] text-muted-foreground">user_id: {row.user_id}</div>
                    {row.user_agent && (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-foreground">User-Agent</p>
                        <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background p-2 text-[11px] text-muted-foreground">
                          {row.user_agent}
                        </pre>
                      </div>
                    )}
                    {row.stack && (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-foreground">Stack</p>
                        <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background p-2 text-[11px] text-muted-foreground">
                          {row.stack}
                        </pre>
                      </div>
                    )}
                    {row.component_stack && (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-foreground">Component stack (React)</p>
                        <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background p-2 text-[11px] text-muted-foreground">
                          {row.component_stack}
                        </pre>
                      </div>
                    )}
                    <div>
                      <p className="mb-1 text-[11px] font-semibold text-foreground">Extra (JSON)</p>
                      <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background p-2 text-[11px] text-muted-foreground">
                        {JSON.stringify(row.extra ?? {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="login" className="space-y-4">
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="icon" onClick={() => void queryLoginFails.refetch()} disabled={queryLoginFails.isFetching}>
              <RefreshCw className={cn("h-4 w-4", queryLoginFails.isFetching && "animate-spin")} />
            </Button>
          </div>
          {queryLoginFails.isError && (
            <p className="text-sm text-destructive">
              {queryLoginFails.error instanceof Error ? queryLoginFails.error.message : String(queryLoginFails.error)}
            </p>
          )}
          {queryLoginFails.isLoading ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : (
            <div className="rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Fingerprint (SHA-256)</TableHead>
                    <TableHead>IP (prefixo)</TableHead>
                    <TableHead>User-Agent (resumo)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(queryLoginFails.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        Sem eventos. Aplique a migration e confirme que o cliente chama a Edge após falhas de login.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (queryLoginFails.data ?? []).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-xs">{formatWhen(r.created_at)}</TableCell>
                        <TableCell className="max-w-[200px] truncate font-mono text-[10px]" title={r.email_fingerprint}>
                          {r.email_fingerprint}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.ip_prefix ?? "—"}</TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{r.user_agent_short ?? "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="icon" onClick={() => void queryAudit.refetch()} disabled={queryAudit.isFetching}>
              <RefreshCw className={cn("h-4 w-4", queryAudit.isFetching && "animate-spin")} />
            </Button>
          </div>
          {queryAudit.isError && (
            <p className="text-sm text-destructive">
              {queryAudit.error instanceof Error ? queryAudit.error.message : String(queryAudit.error)}
            </p>
          )}
          {queryAudit.isLoading ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : (
            <div className="rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Recurso</TableHead>
                    <TableHead>Id</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(queryAudit.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        Sem registos de auditoria (ou triggers ainda não aplicados).
                      </TableCell>
                    </TableRow>
                  ) : (
                    (queryAudit.data ?? []).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-xs">{formatWhen(r.created_at)}</TableCell>
                        <TableCell className="max-w-[120px] truncate font-mono text-[10px]" title={r.actor_user_id}>
                          {r.actor_user_id}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {r.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{r.resource_type}</TableCell>
                        <TableCell className="max-w-[140px] truncate font-mono text-[10px]" title={r.resource_id ?? ""}>
                          {r.resource_id ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
