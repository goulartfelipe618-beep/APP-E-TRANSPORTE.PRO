import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Users, Search, RefreshCw, Crown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PLAN_LABELS, PLAN_COLORS, PlanType, PLAN_ORDER, normalizeUserPlano } from "@/hooks/useUserPlan";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { purgeStoredStateForUserId } from "@/lib/hardDelete";

interface UserItem {
  id: string;
  email: string;
  created_at: string;
  role: string;
  plano: string;
}

const roleLabels: Record<string, string> = {
  admin_transfer: "Motorista Executivo",
  admin_taxi: "Taxista",
  admin_master: "Administrador Master",
};

/** Headers exigidos pelo gateway do Supabase ao chamar Edge Functions pelo fetch */
function edgeFunctionHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  };
}

export default function AdminUsuariosCadastrados() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("free");
  const [filter, setFilter] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formPlano, setFormPlano] = useState<PlanType>("pro");
  const [creating, setCreating] = useState(false);
  const [updatingPlan, setUpdatingPlan] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão não encontrada. Faça login novamente.");
        setUsers([]);
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=list`,
        { headers: edgeFunctionHeaders(session.access_token) }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data?.error === "string" ? data.error : `Erro ao carregar usuários (${res.status})`);
        setUsers([]);
        return;
      }
      setUsers(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const onCadastradosRefresh = () => {
      void fetchUsers();
    };
    window.addEventListener("admin-master-cadastrados-refresh", onCadastradosRefresh);
    return () => window.removeEventListener("admin-master-cadastrados-refresh", onCadastradosRefresh);
  }, [fetchUsers]);

  const showPlanField = formRole === "admin_transfer" || formRole === "admin_taxi";

  const handleCreate = async () => {
    if (!formEmail.trim() || !formPassword || !formRole) {
      toast.error("Preencha e-mail, senha e tipo de utilizador.");
      return;
    }
    if (formPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setCreating(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Sessão expirada.");
      setCreating(false);
      return;
    }

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=create`,
      {
        method: "POST",
        headers: {
          ...edgeFunctionHeaders(session.access_token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formEmail.trim(),
          password: formPassword,
          role: formRole,
          plano: showPlanField ? formPlano : undefined,
        }),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      toast.error(typeof data?.error === "string" ? data.error : `Erro ao criar utilizador (${res.status})`);
    } else {
      toast.success("Utilizador criado com sucesso. Pode iniciar sessão com o e-mail e a senha definidos.");
      setDialogOpen(false);
      setFormEmail("");
      setFormPassword("");
      setFormRole("");
      setFormPlano("pro");
      fetchUsers();
    }
    setCreating(false);
  };

  const confirmDeleteUser = async () => {
    if (!deleteUserId) return;
    setDeleteUserLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão não encontrada.");
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
          body: JSON.stringify({ user_id: deleteUserId }),
        }
      );
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        purgeStoredStateForUserId(deleteUserId);
        toast.success("Usuário e todos os dados excluídos com sucesso!");
        setUsers((prev) => prev.filter((u) => u.id !== deleteUserId));
        setDeleteUserId(null);
      }
    } finally {
      setDeleteUserLoading(false);
    }
  };

  const handleOpenPlanDialog = (user: UserItem) => {
    setSelectedUser(user);
    const p = normalizeUserPlano(user.plano);
    setSelectedPlan(p);
    setPlanDialogOpen(true);
  };

  const handleUpdatePlan = async () => {
    if (!selectedUser) return;
    setUpdatingPlan(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setUpdatingPlan(false); return; }

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=update_plan`,
      {
        method: "POST",
        headers: {
          ...edgeFunctionHeaders(session.access_token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: selectedUser.id, plano: selectedPlan }),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      toast.error(typeof data?.error === "string" ? data.error : `Erro ao atualizar plano (${res.status})`);
    } else {
      toast.success(`Plano atualizado para ${PLAN_LABELS[selectedPlan]}`);
      setPlanDialogOpen(false);
      fetchUsers();
    }
    setUpdatingPlan(false);
  };

  const filtered = users.filter((u) => {
    if (filter !== "todos" && u.role !== filter) return false;
    if (searchTerm && !u.email.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Usuários Cadastrados
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl">
            Crie contas com e-mail e senha, e altere o plano entre <strong className="text-foreground">FREE</strong> e{" "}
            <strong className="text-foreground">PRÓ</strong> para motoristas e taxistas (ícone da coroa na tabela). Apenas o administrador master acede a esta página.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchUsers}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Novo utilizador</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por e-mail..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="admin_transfer">Motorista Executivo</SelectItem>
            <SelectItem value="admin_taxi">Taxista</SelectItem>
            <SelectItem value="admin_master">Administrador Master</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Data de Cadastro</TableHead>
              <TableHead className="w-28 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado.</TableCell></TableRow>
            ) : filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium text-foreground">{u.email}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      u.role === "admin_transfer"
                        ? "default"
                        : u.role === "admin_master"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {roleLabels[u.role] || u.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.role === "admin_master" || u.plano === "n/a" ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    <Badge variant="outline" className={PLAN_COLORS[normalizeUserPlano(u.plano)]}>
                      {PLAN_LABELS[normalizeUserPlano(u.plano)]}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(u.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="text-right flex items-center justify-end gap-1">
                  {u.role !== "admin_master" && (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleOpenPlanDialog(u)} title="Alterar plano">
                        <Crown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteUserId(u.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {u.role === "admin_master" && (
                    <span className="text-xs text-muted-foreground pr-2">Protegido</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo utilizador</DialogTitle>
            <DialogDescription>
              Cria uma conta no Supabase Auth com o e-mail e a palavra-passe indicados. O utilizador pode iniciar sessão de imediato (e-mail já confirmado).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>E-mail *</Label>
              <Input
                type="email"
                autoComplete="off"
                placeholder="utilizador@email.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Senha *</Label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
              />
            </div>
            <div>
              <Label>Tipo de Usuário *</Label>
              <Select value={formRole} onValueChange={(v) => {
                setFormRole(v);
                if (v === "admin_master") setFormPlano("free");
                if (v === "admin_transfer" || v === "admin_taxi") setFormPlano("pro");
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin_transfer">Motorista Executivo</SelectItem>
                  <SelectItem value="admin_taxi">Taxista</SelectItem>
                  <SelectItem value="admin_master">Administrador Master</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {showPlanField && (
              <div>
                <Label>Plano *</Label>
                <Select value={formPlano} onValueChange={(v) => setFormPlano(v as PlanType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLAN_ORDER.map((p) => (
                      <SelectItem key={p} value={p}>{PLAN_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleCreate} disabled={creating} className="w-full">
              {creating ? "A criar…" : "Criar utilizador"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Alterar plano (FREE ↔ PRÓ)
            </DialogTitle>
            <DialogDescription>
              Atualiza o plano deste utilizador na plataforma. Não está disponível para a conta de administrador master.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Utilizador: <span className="text-foreground font-medium">{selectedUser?.email}</span>
            </p>
            <div>
              <Label>Novo plano</Label>
              <Select value={selectedPlan} onValueChange={(v) => setSelectedPlan(v as PlanType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLAN_ORDER.map((p) => (
                    <SelectItem key={p} value={p}>{PLAN_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Pode alternar entre FREE (limitado) e PRÓ (painel completo) quando necessário.
              </p>
            </div>
            <Button onClick={handleUpdatePlan} disabled={updatingPlan} className="w-full">
              {updatingPlan ? "A guardar…" : "Guardar plano"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteUserId !== null}
        onOpenChange={(o) => !o && setDeleteUserId(null)}
        title="Excluir usuário?"
        description="Todos os dados do painel deste usuário serão apagados permanentemente. Esta ação não pode ser desfeita."
        onConfirm={confirmDeleteUser}
        loading={deleteUserLoading}
      />
    </div>
  );
}
