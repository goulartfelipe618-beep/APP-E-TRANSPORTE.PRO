import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Users, Search, RefreshCw, Crown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PLAN_LABELS, PLAN_COLORS, PlanType, PLANS_PAID_ORDER } from "@/hooks/useUserPlan";

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

const PLANS: PlanType[] = ["free", "seed", "grow", "rise", "apex"];

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
  const [formPlano, setFormPlano] = useState<PlanType>("seed");
  const [creating, setCreating] = useState(false);
  const [updatingPlan, setUpdatingPlan] = useState(false);

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
    if (!formEmail || !formPassword || !formRole) {
      toast.error("Preencha todos os campos");
      return;
    }
    setCreating(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setCreating(false); return; }

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=create`,
      {
        method: "POST",
        headers: {
          ...edgeFunctionHeaders(session.access_token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formEmail,
          password: formPassword,
          role: formRole,
          plano: showPlanField ? formPlano : undefined,
        }),
      }
    );
    const data = await res.json();
    if (data.error) {
      toast.error(data.error);
    } else {
      toast.success("Usuário criado com sucesso!");
      setDialogOpen(false);
      setFormEmail("");
      setFormPassword("");
      setFormRole("");
      setFormPlano("seed");
      fetchUsers();
    }
    setCreating(false);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Tem certeza que deseja excluir este usuário? Todos os dados do painel dele serão apagados permanentemente.")) return;
    
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=delete`,
      {
        method: "POST",
        headers: {
          ...edgeFunctionHeaders(session.access_token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: userId }),
      }
    );
    const data = await res.json();
    if (data.error) {
      toast.error(data.error);
      fetchUsers();
    } else {
      toast.success("Usuário e todos os dados excluídos com sucesso!");
    }
  };

  const handleOpenPlanDialog = (user: UserItem) => {
    setSelectedUser(user);
    setSelectedPlan((user.plano || "free") as PlanType);
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
    const data = await res.json();
    if (data.error) {
      toast.error(data.error);
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
          <p className="text-muted-foreground text-sm">Gerencie os usuários que possuem acesso ao dashboard.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchUsers}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Novo Usuário</Button>
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
                    <Badge variant="outline" className={PLAN_COLORS[(u.plano || "free") as PlanType]}>
                      {PLAN_LABELS[(u.plano || "free") as PlanType]}
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(u.id)}>
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
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>E-mail *</Label>
              <Input placeholder="usuario@email.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            </div>
            <div>
              <Label>Senha *</Label>
              <Input type="password" placeholder="Mínimo 6 caracteres" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />
            </div>
            <div>
              <Label>Tipo de Usuário *</Label>
              <Select value={formRole} onValueChange={(v) => {
                setFormRole(v);
                if (v === "admin_master") setFormPlano("free");
                if (v === "admin_transfer" || v === "admin_taxi") setFormPlano("seed");
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
                    {PLANS_PAID_ORDER.map((p) => (
                      <SelectItem key={p} value={p}>{PLAN_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleCreate} disabled={creating} className="w-full">
              {creating ? "Criando..." : "Criar Usuário"}
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
              Alterar Plano
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Usuário: <span className="text-foreground font-medium">{selectedUser?.email}</span>
            </p>
            <div>
              <Label>Novo Plano</Label>
              <Select value={selectedPlan} onValueChange={(v) => setSelectedPlan(v as PlanType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLANS.map((p) => (
                    <SelectItem key={p} value={p}>{PLAN_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleUpdatePlan} disabled={updatingPlan} className="w-full">
              {updatingPlan ? "Atualizando..." : "Salvar Plano"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
