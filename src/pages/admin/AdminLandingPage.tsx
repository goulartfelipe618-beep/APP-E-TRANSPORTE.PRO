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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RefreshCw, Users, ClipboardList, Clock, Loader2, Trash2, Settings2, UserPlus } from "lucide-react";

/** Dispara atualização da lista em Usuários > Cadastrados sem F5 */
const ADMIN_CADASTRADOS_REFRESH = "admin-master-cadastrados-refresh";

type SolicitacaoMotorista = {
  id: string;
  user_id: string;
  lead_user_id?: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  cpf?: string | null;
  cnh?: string | null;
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

const PLANO_OPTIONS: { value: string; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "seed", label: "Seed" },
  { value: "grow", label: "Grow" },
  { value: "rise", label: "Rise" },
  { value: "apex", label: "Apex" },
];

export default function AdminLandingPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SolicitacaoComPlano[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SolicitacaoComPlano | null>(null);
  const [planDialogRow, setPlanDialogRow] = useState<SolicitacaoComPlano | null>(null);
  const [planDraft, setPlanDraft] = useState<string>("free");

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

      const { data: plans, error: plansErr } =
        leadUserIds.length > 0
          ? await supabase
              .from("user_plans")
              .select("user_id,plano")
              .in("user_id", leadUserIds)
          : ({ data: [], error: null } as { data: any[]; error: any });

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

  const edgeFunctionHeaders = (accessToken: string): HeadersInit => {
    return {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    };
  };

  const deleteRowOnly = async (id: string) => {
    setSavingId(id);
    try {
      const { error } = await supabase
        .from("solicitacoes_motoristas")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Registro excluído.");
      setDeleteTarget(null);
      await fetchData();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao excluir registro";
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteUser = async (leadUserId: string) => {
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
      setDeleteTarget(null);
      await fetchData();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao excluir";
      toast.error(message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    const leadUserId = deleteTarget.lead_user_id;

    if (!leadUserId) {
      await deleteRowOnly(id);
      return;
    }

    setSavingId(id);
    try {
      await handleDeleteUser(leadUserId);
    } finally {
      setSavingId(null);
    }
  };

  const openPlanDialog = (s: SolicitacaoComPlano) => {
    setPlanDraft(s.plano);
    setPlanDialogRow(s);
  };

  const handleFinalizeCadastro = async (s: SolicitacaoComPlano) => {
    if (!s.lead_user_id) {
      toast.error("Este lead não tem usuário vinculado ao sistema.");
      return;
    }

    setSavingId(s.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão não encontrada. Faça login novamente.");
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=finalize_landing_lead`,
        {
          method: "POST",
          headers: {
            ...edgeFunctionHeaders(session.access_token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ solicitacao_id: s.id }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        toast.error(typeof data?.error === "string" ? data.error : `Erro (${res.status})`);
        return;
      }

      setItems((prev) => prev.filter((row) => row.id !== s.id));
      toast.success("Usuário confirmado em Cadastrados. Lead removido da Landing Page.");
      window.dispatchEvent(new CustomEvent(ADMIN_CADASTRADOS_REFRESH));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao finalizar cadastro";
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdatePlan = async () => {
    if (!planDialogRow?.lead_user_id) {
      toast.error("Não há login vinculado a este lead para alterar o plano.");
      return;
    }

    setSavingId(planDialogRow.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão não encontrada. Faça login novamente.");
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=update_plan`,
        {
          method: "POST",
          headers: {
            ...edgeFunctionHeaders(session.access_token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user_id: planDialogRow.lead_user_id, plano: planDraft }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        toast.error(typeof data?.error === "string" ? data.error : `Erro (${res.status})`);
        return;
      }

      toast.success("Plano atualizado.");
      setPlanDialogRow(null);
      await fetchData();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao atualizar plano";
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  };

  const deleteBusy = deleteTarget && savingId === deleteTarget.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" /> Landing Page
          </h1>
          <p className="text-muted-foreground">
            O webhook já cria o login com role Motorista Executivo e plano FREE. Use Cadastrar para
            confirmar e enviar o usuário para Usuários Cadastrados (o lead sai desta lista).
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
                  <TableHead>Documentos</TableHead>
                  <TableHead>Detalhes</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-[280px]">Ações</TableHead>
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
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="space-y-1">
                        <div>CPF: {s.cpf || "—"}</div>
                        <div>CNH: {s.cnh || "—"}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[340px]">
                      <div className="whitespace-pre-wrap break-words">{s.mensagem || "—"}</div>
                    </TableCell>
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
                        <Button
                          size="sm"
                          disabled={savingId === s.id || !s.lead_user_id}
                          title={
                            !s.lead_user_id
                              ? "Aguarde o webhook criar o login ou use Excluir"
                              : "Confirma o pré-cadastro: usuário em Cadastrados e remove o lead daqui"
                          }
                          onClick={() => void handleFinalizeCadastro(s)}
                        >
                          <UserPlus className="h-4 w-4 mr-1" /> Cadastrar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={savingId === s.id || !s.lead_user_id}
                          title={!s.lead_user_id ? "Sem login vinculado — não é possível alterar o plano" : undefined}
                          onClick={() => openPlanDialog(s)}
                        >
                          <Settings2 className="h-4 w-4 mr-1" /> Plano
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={savingId === s.id}
                          onClick={() => setDeleteTarget(s)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Excluir
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.lead_user_id
                ? "Esta ação remove o registro da solicitação e exclui permanentemente o usuário de login vinculado a este lead. Esta operação não pode ser desfeita."
                : "Esta ação remove apenas o registro desta solicitação (não havia login criado)."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deleteBusy}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!!deleteBusy}
              onClick={() => void confirmDelete()}
            >
              {deleteBusy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Excluindo…
                </>
              ) : (
                "Excluir"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!planDialogRow} onOpenChange={(open) => !open && setPlanDialogRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar plano</DialogTitle>
            <DialogDescription>
              Define o plano do usuário vinculado a este lead ({planDialogRow?.email || "sem e-mail"}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="plano-landing">Plano</Label>
            <Select value={planDraft} onValueChange={setPlanDraft}>
              <SelectTrigger id="plano-landing">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {PLANO_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPlanDialogRow(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={planDialogRow ? savingId === planDialogRow.id : false}
              onClick={() => void handleUpdatePlan()}
            >
              {planDialogRow && savingId === planDialogRow.id ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando…
                </>
              ) : (
                "Salvar plano"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
