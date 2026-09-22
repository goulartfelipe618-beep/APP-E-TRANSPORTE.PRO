import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, Search, RefreshCw, Activity } from "lucide-react";
import UserActivityTerminalDialog from "@/components/admin/UserActivityTerminalDialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { validatePainelStrongPassword } from "@/lib/motoristaPortalPassword";

interface UserItem {
  id: string;
  email: string;
  created_at: string;
  role: string;
  plano: string;
  /** true = `billing_manual_override`; webhooks Mercado Pago não alteram o plano. */
  plano_bloqueado_mp?: boolean;
}

const roleLabels: Record<string, string> = {
  admin_transfer: "Motorista Executivo",
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
  const [filter, setFilter] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("");
  const [creating, setCreating] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityUser, setActivityUser] = useState<UserItem | null>(null);

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

  const handleCreate = async () => {
    if (!formEmail.trim() || !formPassword || !formRole) {
      toast.error("Preencha e-mail, senha e tipo de utilizador.");
      return;
    }
    const pwErr = validatePainelStrongPassword(formPassword);
    if (pwErr) {
      toast.error(pwErr);
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
      fetchUsers();
    }
    setCreating(false);
  };

  const handleOpenActivityDialog = (user: UserItem) => {
    setActivityUser(user);
    setActivityDialogOpen(true);
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
            Crie contas com e-mail e senha. O sistema é único (R$ 69,90/mês) — sem planos FREE, STANDART ou PRÓ.
            A remoção de utilizadores faz-se no Supabase (Auth e dados). Apenas o administrador master acede a esta página.
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
              <TableHead>Data de Cadastro</TableHead>
              <TableHead className="w-28 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado.</TableCell></TableRow>
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
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(u.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="text-right">
                  {u.role !== "admin_master" ? (
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#FF6600] hover:text-[#FF6600]"
                        onClick={() => handleOpenActivityDialog(u)}
                        title="Atividades do utilizador"
                      >
                        <Activity className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
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
        <DialogContent className="sm:max-w-lg">
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
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin_transfer">Motorista Executivo</SelectItem>
                  <SelectItem value="admin_master">Administrador Master</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formRole === "admin_transfer" ? (
              <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed">
                <p>
                  O valor do sistema é de <strong className="text-foreground">R$ 69,90/mês</strong>.
                </p>
                <p>
                  Comunicador (vouchers, confirmações, cobranças e mensagens no WhatsApp com botões e cards): adicional de{" "}
                  <strong className="text-foreground">R$ 40,00/mês</strong>.
                </p>
                <p>
                  Reservas manuais e reservas externas (ex.: pelo site). Site integrado ao sistema, se ainda não tiver:{" "}
                  <strong className="text-foreground">R$ 100,00</strong>.
                </p>
                <p>
                  Inclui motoristas parceiros com painel de agenda, clientes, veículos, receptivos e financeiro — tudo
                  no mesmo sistema. Sem planos FREE, STANDART ou PRÓ.
                </p>
              </div>
            ) : null}
            <Button onClick={handleCreate} disabled={creating} className="w-full">
              {creating ? "A criar…" : "Criar utilizador"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <UserActivityTerminalDialog
        open={activityDialogOpen}
        onOpenChange={setActivityDialogOpen}
        userId={activityUser?.id ?? null}
        userEmail={activityUser?.email ?? null}
      />
    </div>
  );
}
