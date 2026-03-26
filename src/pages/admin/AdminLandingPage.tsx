import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Users, ClipboardList, Clock, Loader2 } from "lucide-react";

type SolicitacaoMotorista = {
  id: string;
  user_id: string;
  lead_user_id?: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  mensagem: string | null;
  status: string;
  created_at: string;
};

type SolicitacaoComPlano = SolicitacaoMotorista & { plano: string };

const STATUS_LABELS: Record<string, string> = {
  testando: "Testando",
  pendente: "Pendente",
  em_andamento: "Em andamento",
  cadastrado: "Cadastrado",
  recusado: "Recusado",
  concluido: "Concluído",
  desativado: "Desativado",
};

const STATUS_CLASSES: Record<string, string> = {
  testando: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  pendente: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  em_andamento: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  cadastrado: "bg-green-500/10 text-green-700 border-green-500/30",
  recusado: "bg-red-500/10 text-red-700 border-red-500/30",
  concluido: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  desativado: "bg-red-500/10 text-red-700 border-red-500/30",
};

const STATUS_OPTIONS = ["testando", "pendente", "em_andamento", "cadastrado", "recusado", "concluido", "desativado"];

export default function AdminLandingPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SolicitacaoComPlano[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteConfirmState, setDeleteConfirmState] = useState<{ id: string; stage: 1 | 2 } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: solicitacoes, error } = await supabase
        .from("solicitacoes_motoristas")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (solicitacoes || []) as SolicitacaoMotorista[];
      const leadUserIds = [...new Set(rows.map((r) => r.lead_user_id).filter(Boolean))] as string[];

      const { data: plans, error: plansErr } = await supabase
        .from("user_plans")
        .select("user_id,plano")
        .in("user_id", leadUserIds.length ? leadUserIds : ["__none__"]);

      if (plansErr) throw plansErr;

      const planMap = new Map((plans || []).map((p) => [p.user_id, p.plano]));

      const withPlans: SolicitacaoComPlano[] = rows.map((r) => ({
        ...r,
        plano: (r.lead_user_id ? planMap.get(r.lead_user_id) : undefined) || "free",
      }));

      setItems(withPlans);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao carregar Landing Page";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => items, [items]);

  const updateStatus = async (id: string, status: string) => {
    setSavingId(id);
    try {
      const { error } = await supabase
        .from("solicitacoes_motoristas")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      toast.success("Status atualizado!");
      await fetchData();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao atualizar status";
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  };

  const edgeFunctionHeaders = (accessToken: string): HeadersInit => {
    return {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    };
  };

  const handleDisable = async (leadUserId?: string | null) => {
    if (!leadUserId) {
      toast.error("lead_user_id não encontrado para este registro.");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão não encontrada. Faça login novamente.");
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=disable_user`,
        {
          method: "POST",
          headers: {
            ...edgeFunctionHeaders(session.access_token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id: leadUserId }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        toast.error(typeof data?.error === "string" ? data.error : `Erro (${res.status})`);
        return;
      }

      toast.success("Usuário desativado com sucesso.");
      setDeleteConfirmState(null);
      await fetchData();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao desativar";
      toast.error(message);
    }
  };

  const handleDelete = async (leadUserId?: string | null) => {
    if (!leadUserId) {
      toast.error("lead_user_id não encontrado. Não foi possível excluir.");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão não encontrada. Faça login novamente.");
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=delete`,
        {
          method: "POST",
          headers: {
            ...edgeFunctionHeaders(session.access_token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id: leadUserId }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        toast.error(typeof data?.error === "string" ? data.error : `Erro (${res.status})`);
        return;
      }

      toast.success("Solicitação e usuário excluídos com sucesso.");
      setDeleteConfirmState(null);
      await fetchData();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao excluir";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" /> Landing Page
          </h1>
          <p className="text-muted-foreground">
            Solicitações recebidas do formulário oficial (plano do destinatário: FREE/PAGOS).
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" /> Solicitações de Motoristas ({filtered.length})
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <ClipboardList className="h-10 w-10 opacity-40 mb-2" />
            <p>Nenhuma solicitação encontrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[360px]">Atualizar & Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.nome}</TableCell>
                    <TableCell className="text-sm">
                      <div className="leading-5">
                        <div>{s.email || "—"}</div>
                        <div className="text-xs text-muted-foreground">{s.telefone || ""}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{s.cidade || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(s.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{s.plano}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_CLASSES[s.status] || "bg-muted text-foreground border-border"}
                      >
                        {(s.status === "pendente" || s.status === "testando") && <Clock className="h-3 w-3 mr-1" />}
                        {STATUS_LABELS[s.status] || s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2 items-center">
                        <Select
                          value={s.status}
                          disabled={savingId === s.id}
                          onValueChange={(v) => updateStatus(s.id, v)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {STATUS_LABELS[opt] || opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!s.lead_user_id}
                          onClick={() => handleDisable(s.lead_user_id)}
                        >
                          Desativar
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (!s.lead_user_id) {
                              toast.error("lead_user_id não encontrado.");
                              return;
                            }
                            if (deleteConfirmState?.id !== s.id) {
                              setDeleteConfirmState({ id: s.id, stage: 1 });
                              toast.info("Clique novamente para confirmar a exclusão (2/3).");
                              return;
                            }

                            if (deleteConfirmState.stage === 1) {
                              setDeleteConfirmState({ id: s.id, stage: 2 });
                              toast.info("Clique novamente para confirmar a exclusão (3/3).");
                              return;
                            }

                            // stage === 2: perform delete on 3rd click
                            void handleDelete(s.lead_user_id);
                          }}
                        >
                          {deleteConfirmState?.id === s.id
                            ? deleteConfirmState.stage === 1
                              ? "Confirmar excluir (2/3)"
                              : "Confirmar excluir (3/3)"
                            : "Excluir"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

