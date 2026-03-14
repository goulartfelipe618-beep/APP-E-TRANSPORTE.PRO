import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, Filter, Building2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

export default function AdminNetworkPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [data, setData] = useState<NetworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [filtroEstado, setFiltroEstado] = useState("all");
  const [filtroCidade, setFiltroCidade] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const { data: rows, error } = await (supabase.from("network" as any).select("*") as any);
    if (error) toast.error("Erro ao carregar networks");
    else setData(rows || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id: string) => {
    const { error } = await (supabase.from("network" as any).delete().eq("id", id) as any);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Removido!"); fetchData(); }
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
          <Button variant="outline" size="icon" onClick={fetchData}>
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
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <CriarNetworkDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={fetchData} />
    </div>
  );
}
