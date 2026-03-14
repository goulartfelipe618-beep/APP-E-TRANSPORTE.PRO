import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, Filter, Building2, Trash2, UserPlus, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import CriarNetworkDialog from "@/components/network/CriarNetworkDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NetworkItem {
  id: string;
  nome_empresa: string;
  categoria: string;
  cidade: string;
  estado: string;
  status_contato: string;
  potencial_negocio: string;
  nome_contato: string;
  email_corporativo: string;
  telefone_direto: string;
  motorista_atribuido_id: string | null;
}

interface DriverItem {
  id: string;
  email: string;
  role: string;
}

export default function AdminNetworkPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [data, setData] = useState<NetworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [filtroEstado, setFiltroEstado] = useState("all");
  const [filtroCidade, setFiltroCidade] = useState("");

  // Assign driver state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [assigning, setAssigning] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data: rows, error } = await (supabase.from("network" as any).select("*") as any);
    if (error) toast.error("Erro ao carregar networks");
    else setData(rows || []);
    setLoading(false);
  };

  const fetchDrivers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=list`,
      { headers: { Authorization: `Bearer ${session.access_token}` } }
    );
    const list = await res.json();
    if (Array.isArray(list)) {
      setDrivers(list.filter((u: DriverItem) => u.role === "admin_transfer"));
    }
  };

  useEffect(() => { fetchData(); fetchDrivers(); }, []);

  const handleDelete = async (id: string) => {
    const { error } = await (supabase.from("network" as any).delete().eq("id", id) as any);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Removido!"); fetchData(); }
  };

  const openAssignDialog = (networkId: string, currentDriverId: string | null) => {
    setSelectedNetworkId(networkId);
    setSelectedDriverId(currentDriverId || "");
    setAssignDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedNetworkId) return;
    setAssigning(true);
    const { error } = await (supabase.from("network" as any)
      .update({ motorista_atribuido_id: selectedDriverId || null } as any)
      .eq("id", selectedNetworkId) as any);
    setAssigning(false);
    if (error) { toast.error("Erro ao atribuir: " + error.message); return; }
    toast.success(selectedDriverId ? "Motorista atribuído com sucesso!" : "Atribuição removida!");
    setAssignDialogOpen(false);
    fetchData();
  };

  const filtered = data.filter((item) => {
    if (filtroCategoria !== "all" && item.categoria !== filtroCategoria) return false;
    if (filtroStatus !== "all" && item.status_contato !== filtroStatus) return false;
    if (filtroEstado !== "all" && item.estado !== filtroEstado) return false;
    if (filtroCidade && !item.cidade?.toLowerCase().includes(filtroCidade.toLowerCase())) return false;
    return true;
  });

  const categorias = [...new Set(data.map((d) => d.categoria).filter(Boolean))];
  const estados = [...new Set(data.map((d) => d.estado).filter(Boolean))];
  const statuses = [...new Set(data.map((d) => d.status_contato).filter(Boolean))];

  const getDriverEmail = (driverId: string | null) => {
    if (!driverId) return null;
    return drivers.find((d) => d.id === driverId)?.email || driverId;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span className="text-primary">⊕</span> Network — Admin Master
          </h1>
          <p className="text-muted-foreground">Empresas da E-Transporte.pro que podem ser atribuídas a motoristas cadastrados</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => { fetchData(); fetchDrivers(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button className="bg-primary text-primary-foreground" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Cadastrar Network
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4" /> Filtros
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Categoria</label>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Categorias</SelectItem>
                {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Status</label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Estado (UF)</label>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {estados.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Cidade</label>
            <Input placeholder="Filtrar por cidade..." value={filtroCidade} onChange={(e) => setFiltroCidade(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Empresas da E-Transporte.pro
          <Badge variant="secondary" className="ml-2">{filtered.length} registros</Badge>
        </h3>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Building2 className="h-10 w-10 mb-2 opacity-40" />
            <p>Nenhuma empresa cadastrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Potencial</TableHead>
                  <TableHead>Atribuído a</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nome_empresa}</TableCell>
                    <TableCell>{item.categoria}</TableCell>
                    <TableCell>{item.cidade}{item.estado ? `/${item.estado}` : ""}</TableCell>
                    <TableCell>{item.nome_contato}</TableCell>
                    <TableCell><Badge variant="outline">{item.status_contato}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{item.potencial_negocio}</Badge></TableCell>
                    <TableCell>
                      {item.motorista_atribuido_id ? (
                        <Badge className="bg-primary/10 text-primary border-primary/20">
                          <Check className="h-3 w-3 mr-1" />
                          {getDriverEmail(item.motorista_atribuido_id)?.split("@")[0]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Não atribuído</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openAssignDialog(item.id, item.motorista_atribuido_id)} title="Atribuir motorista">
                          <UserPlus className="h-4 w-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      <CriarNetworkDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={fetchData} />

      {/* Dialog Atribuir Motorista */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Atribuir Motorista
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione um motorista executivo para receber esta empresa no painel dele.
            </p>
            <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
              <SelectTrigger><SelectValue placeholder="Selecione um motorista" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (remover atribuição)</SelectItem>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={assigning}>
              {assigning ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
