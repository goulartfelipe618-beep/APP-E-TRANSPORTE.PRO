import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Eye, Trash2, Users, RefreshCw, Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PLAN_LABELS, PLANS_PAID_ORDER, PlanType, normalizeUserPlano } from "@/hooks/useUserPlan";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

/** Dispara atualização da lista em Usuários > Cadastrados sem F5 */
const ADMIN_CADASTRADOS_REFRESH = "admin-master-cadastrados-refresh";

interface SolicitacaoAcesso {
  id: string;
  nome_completo: string;
  email: string;
  telefone: string;
  cidade: string | null;
  estado: string | null;
  mensagem: string | null;
  tipo_interesse: string;
  status: string;
  created_at: string;
}

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

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  em_contato: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  aprovado: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  recusado: "bg-red-500/20 text-red-400 border-red-500/30",
};

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_contato: "Em Contato",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

const interesseLabels: Record<string, string> = {
  conhecer: "Conhecer o sistema",
  teste: "Teste gratuito",
  contratar: "Contratar",
};

const STATUS_LABELS_MOTORISTA: Record<string, string> = {
  testando: "Testando",
  pendente: "Pendente",
  em_andamento: "Em andamento",
  cadastrado: "Cadastrado",
  recusado: "Recusado",
  concluido: "Concluído",
  desativado: "Desativado",
};

const STATUS_CLASSES_MOTORISTA: Record<string, string> = {
  testando: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  pendente: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  em_andamento: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  cadastrado: "bg-green-500/10 text-green-700 border-green-500/30",
  recusado: "bg-red-500/10 text-red-700 border-red-500/30",
  concluido: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  desativado: "bg-red-500/10 text-red-700 border-red-500/30",
};

function edgeFunctionHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  };
}

export default function AdminUsuariosSolicitacoes() {
  const [tab, setTab] = useState("cadastro-site");

  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAcesso[]>([]);
  const [loadingAcesso, setLoadingAcesso] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [selected, setSelected] = useState<SolicitacaoAcesso | null>(null);

  const [loadingMotorista, setLoadingMotorista] = useState(true);
  const [itemsMotorista, setItemsMotorista] = useState<SolicitacaoComPlano[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SolicitacaoComPlano | null>(null);
  const [finalizeTarget, setFinalizeTarget] = useState<SolicitacaoComPlano | null>(null);
  const [finalizePlano, setFinalizePlano] = useState<PlanType>("pro");
  const [acessoDeleteId, setAcessoDeleteId] = useState<string | null>(null);
  const [acessoDeleteLoading, setAcessoDeleteLoading] = useState(false);

  const fetchSolicitacoesAcesso = async () => {
    const { data, error } = await supabase
      .from("solicitacoes_acesso")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setSolicitacoes(data as SolicitacaoAcesso[]);
    setLoadingAcesso(false);
  };

  const fetchMotoristas = useCallback(async () => {
    setLoadingMotorista(true);
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
          ? await supabase.from("user_plans").select("user_id,plano").in("user_id", leadUserIds)
          : { data: [], error: null };

      if (plansErr) throw plansErr;

      const planMap = new Map((plans || []).map((p: { user_id: string; plano: string }) => [p.user_id, p.plano]));

      const withPlans: SolicitacaoComPlano[] = rows.map((r) => ({
        ...r,
        plano: (r.lead_user_id ? planMap.get(r.lead_user_id) : undefined) || "free",
      }));

      setItemsMotorista(withPlans);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao carregar solicitações";
      toast.error(message);
    } finally {
      setLoadingMotorista(false);
    }
  }, []);

  useEffect(() => {
    void fetchSolicitacoesAcesso();
  }, []);

  useEffect(() => {
    void fetchMotoristas();
  }, [fetchMotoristas]);

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("solicitacoes_acesso")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success("Status atualizado!");
    void fetchSolicitacoesAcesso();
    if (selected?.id === id) setSelected((prev) => (prev ? { ...prev, status: newStatus } : null));
  };

  const confirmDeleteSolicitacaoAcesso = async () => {
    if (!acessoDeleteId) return;
    setAcessoDeleteLoading(true);
    try {
      const { error } = await supabase.from("solicitacoes_acesso").delete().eq("id", acessoDeleteId);
      if (error) {
        toast.error("Erro ao excluir");
        return;
      }
      toast.success("Solicitação excluída!");
      setAcessoDeleteId(null);
      void fetchSolicitacoesAcesso();
      if (selected?.id === acessoDeleteId) setSelected(null);
    } finally {
      setAcessoDeleteLoading(false);
    }
  };

  const filtered = filtroStatus === "todos" ? solicitacoes : solicitacoes.filter((s) => s.status === filtroStatus);

  const deleteRowOnly = async (id: string) => {
    setSavingId(id);
    try {
      const { error } = await supabase.from("solicitacoes_motoristas").delete().eq("id", id);
      if (error) throw error;
      toast.success("Registro excluído.");
      setDeleteTarget(null);
      await fetchMotoristas();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao excluir registro";
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteUser = async (leadUserId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Sessão não encontrada. Faça login novamente.");
      return;
    }

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=delete`, {
      method: "POST",
      headers: {
        ...edgeFunctionHeaders(session.access_token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: leadUserId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      toast.error(typeof data?.error === "string" ? data.error : `Erro (${res.status})`);
      return;
    }

    toast.success("Solicitação e usuário excluídos com sucesso.");
    setDeleteTarget(null);
    await fetchMotoristas();
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

  const handleFinalizeCadastro = async () => {
    const s = finalizeTarget;
    if (!s?.lead_user_id) {
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
          body: JSON.stringify({ solicitacao_id: s.id, plano: finalizePlano }),
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        toast.error(typeof data?.error === "string" ? data.error : `Erro (${res.status})`);
        return;
      }

      setItemsMotorista((prev) => prev.filter((row) => row.id !== s.id));
      setFinalizeTarget(null);
      toast.success(`Usuário cadastrado com plano ${PLAN_LABELS[finalizePlano]}. Removido da fila de solicitações.`);
      window.dispatchEvent(new CustomEvent(ADMIN_CADASTRADOS_REFRESH));
      await fetchMotoristas();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao finalizar cadastro";
      toast.error(message);
    } finally {
      setSavingId(null);
    }
  };

  const deleteBusy = deleteTarget && savingId === deleteTarget.id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          Solicitações
        </h1>
        <p className="text-muted-foreground mt-1">
          Cadastros vindos do site (plano FREE com acesso liberado) e solicitações de interesse no sistema.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="cadastro-site">Cadastro pelo site</TabsTrigger>
          <TabsTrigger value="interesse">Interesse / contato</TabsTrigger>
        </TabsList>

        <TabsContent value="cadastro-site" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground max-w-3xl">
              O webhook cria o login em <strong className="text-foreground">FREE</strong>. Em{" "}
              <strong className="text-foreground">Cadastrar</strong>, confirme o plano <strong className="text-foreground">PRÓ</strong>{" "}
              para concluir o cadastro em Usuários → Cadastrados e retirar da fila.
            </p>
            <Button variant="outline" size="icon" onClick={() => void fetchMotoristas()} disabled={loadingMotorista}>
              {loadingMotorista ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" /> Pré-cadastros ({itemsMotorista.length})
            </h3>

            {loadingMotorista ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
            ) : itemsMotorista.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <ClipboardList className="h-10 w-10 opacity-40 mb-2" />
                <p>Nenhuma solicitação de cadastro pelo site.</p>
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
                      <TableHead className="min-w-[200px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsMotorista.map((s) => (
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
                          <Badge variant="outline">{PLAN_LABELS[normalizeUserPlano(s.plano)]}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              STATUS_CLASSES_MOTORISTA[s.status] || "bg-muted text-foreground border-border"
                            }
                          >
                            {STATUS_LABELS_MOTORISTA[s.status] || s.status}
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
                                  : "Definir plano pago e confirmar em Cadastrados"
                              }
                              onClick={() => {
                                setFinalizePlano("pro");
                                setFinalizeTarget(s);
                              }}
                            >
                              <UserPlus className="h-4 w-4 mr-1" /> Cadastrar
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
        </TabsContent>

        <TabsContent value="interesse" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_contato">Em Contato</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="recusado">Recusado</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{filtered.length} solicitação(ões)</span>
          </div>

          {loadingAcesso ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-1">Nenhuma solicitação encontrada</h3>
              <p className="text-sm text-muted-foreground">Compartilhe o link do formulário para receber solicitações.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{s.nome_completo}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {s.email} · {s.telefone}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={statusColors[s.status] || ""}>
                        {statusLabels[s.status] || s.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {interesseLabels[s.tipo_interesse] || s.tipo_interesse}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Select value={s.status} onValueChange={(v) => void updateStatus(s.id, v)}>
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="em_contato">Em Contato</SelectItem>
                        <SelectItem value="aprovado">Aprovado</SelectItem>
                        <SelectItem value="recusado">Recusado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => setSelected(s)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setAcessoDeleteId(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes da Solicitação</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="space-y-4 mt-4">
              <Field label="Nome" value={selected.nome_completo} />
              <Field label="E-mail" value={selected.email} />
              <Field label="Telefone" value={selected.telefone} />
              <Field label="Cidade" value={selected.cidade || "—"} />
              <Field label="Estado" value={selected.estado || "—"} />
              <Field label="Interesse" value={interesseLabels[selected.tipo_interesse] || selected.tipo_interesse} />
              <Field label="Mensagem" value={selected.mensagem || "Nenhuma mensagem"} />
              <Field label="Data" value={new Date(selected.created_at).toLocaleString("pt-BR")} />
              <Field label="Status" value={statusLabels[selected.status] || selected.status} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!finalizeTarget} onOpenChange={(o) => !o && setFinalizeTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar cadastro</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Escolha o plano pago para <span className="font-medium text-foreground">{finalizeTarget?.nome}</span>. O usuário
            passa a constar em <strong className="text-foreground">Usuários → Cadastrados</strong> e sai desta fila. O plano{" "}
            <strong className="text-foreground">FREE</strong> permanece apenas para pré-cadastros do site.
          </p>
          <div className="space-y-2">
            <Label>Plano do cliente *</Label>
            <Select value={finalizePlano} onValueChange={(v) => setFinalizePlano(v as PlanType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANS_PAID_ORDER.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PLAN_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setFinalizeTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleFinalizeCadastro()} disabled={!!savingId}>
              {savingId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar cadastro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={acessoDeleteId !== null}
        onOpenChange={(o) => !o && setAcessoDeleteId(null)}
        title="Excluir solicitação?"
        description="O registro desta solicitação (cadastro pelo site) será removido permanentemente. Deseja continuar?"
        onConfirm={confirmDeleteSolicitacaoAcesso}
        loading={acessoDeleteLoading}
      />

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
            <Button variant="destructive" disabled={!!deleteBusy} onClick={() => void confirmDelete()}>
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
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
