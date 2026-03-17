import { useState, useEffect } from "react";
import { Plane, Check, X, Pencil, Eye, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EmptyLag {
  id: string;
  origem: string;
  destino: string;
  data_hora: string | null;
  observacoes: string | null;
  status: string;
  editado_por: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminEmptyLegsPage() {
  const [items, setItems] = useState<EmptyLag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [detalhesItem, setDetalhesItem] = useState<EmptyLag | null>(null);
  const [editItem, setEditItem] = useState<EmptyLag | null>(null);
  const [editForm, setEditForm] = useState({ origem: "", destino: "", data_hora: "", observacoes: "" });

  const fetchItems = async () => {
    let query = supabase.from("empty_lags").select("*").order("created_at", { ascending: false });
    if (filtroStatus !== "todos") {
      query = query.eq("status", filtroStatus);
    }
    const { data, error } = await query;
    if (error) {
      toast.error("Erro ao carregar Empty Legs");
    } else {
      setItems((data as EmptyLag[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, [filtroStatus]);

  const updateStatus = async (id: string, newStatus: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("empty_lags").update({
      status: newStatus,
      editado_por: user?.email || "admin",
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      toast.success(`Status alterado para ${newStatus}`);
      fetchItems();
    }
  };

  const openEdit = (item: EmptyLag) => {
    setEditItem(item);
    setEditForm({
      origem: item.origem,
      destino: item.destino,
      data_hora: item.data_hora ? item.data_hora.slice(0, 16) : "",
      observacoes: item.observacoes || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("empty_lags").update({
      origem: editForm.origem,
      destino: editForm.destino,
      data_hora: editForm.data_hora || null,
      observacoes: editForm.observacoes,
      editado_por: user?.email || "admin",
      updated_at: new Date().toISOString(),
    }).eq("id", editItem.id);
    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Empty Leg atualizada!");
      setEditItem(null);
      fetchItems();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">🟡 Pendente</Badge>;
      case "aprovado":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">🟢 Aprovado</Badge>;
      case "reprovado":
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">🔴 Reprovado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try {
      return format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Plane className="h-6 w-6 text-primary" />
            Empty Legs — Administração
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie as Empty Legs recebidas via webhook do N8N.</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
              <SelectItem value="reprovado">Reprovado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-12">Carregando...</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma Empty Leg encontrada{filtroStatus !== "todos" ? ` com status "${filtroStatus}"` : ""}.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <Card key={item.id} className="border-border">
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      {getStatusBadge(item.status)}
                      <span className="text-xs text-muted-foreground">
                        Recebido em {formatDate(item.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Plane className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground">{item.origem || "—"}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-semibold text-foreground">{item.destino || "—"}</span>
                    </div>
                    {item.data_hora && (
                      <p className="text-sm text-muted-foreground">📅 {formatDate(item.data_hora)}</p>
                    )}
                    {item.observacoes && (
                      <p className="text-sm text-muted-foreground line-clamp-2">📝 {item.observacoes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => setDetalhesItem(item)}>
                      <Eye className="h-4 w-4 mr-1" /> Detalhes
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4 mr-1" /> Editar
                    </Button>
                    {item.status !== "aprovado" && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => updateStatus(item.id, "aprovado")}>
                        <Check className="h-4 w-4 mr-1" /> Aprovar
                      </Button>
                    )}
                    {item.status !== "reprovado" && (
                      <Button size="sm" variant="destructive" onClick={() => updateStatus(item.id, "reprovado")}>
                        <X className="h-4 w-4 mr-1" /> Reprovar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Detalhes */}
      <Dialog open={!!detalhesItem} onOpenChange={() => setDetalhesItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Empty Leg</DialogTitle>
          </DialogHeader>
          {detalhesItem && (
            <div className="space-y-3 text-sm">
              <div><strong>Status:</strong> {getStatusBadge(detalhesItem.status)}</div>
              <div><strong>Origem:</strong> {detalhesItem.origem || "—"}</div>
              <div><strong>Destino:</strong> {detalhesItem.destino || "—"}</div>
              <div><strong>Data/Hora:</strong> {formatDate(detalhesItem.data_hora)}</div>
              <div><strong>Observações:</strong> {detalhesItem.observacoes || "—"}</div>
              <div><strong>Editado por:</strong> {detalhesItem.editado_por || "—"}</div>
              <div><strong>Recebido em:</strong> {formatDate(detalhesItem.created_at)}</div>
              <div><strong>Atualizado em:</strong> {formatDate(detalhesItem.updated_at)}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Empty Leg</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Origem</Label>
              <Input value={editForm.origem} onChange={(e) => setEditForm((f) => ({ ...f, origem: e.target.value }))} />
            </div>
            <div>
              <Label>Destino</Label>
              <Input value={editForm.destino} onChange={(e) => setEditForm((f) => ({ ...f, destino: e.target.value }))} />
            </div>
            <div>
              <Label>Data/Hora</Label>
              <Input type="datetime-local" value={editForm.data_hora} onChange={(e) => setEditForm((f) => ({ ...f, data_hora: e.target.value }))} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={editForm.observacoes} onChange={(e) => setEditForm((f) => ({ ...f, observacoes: e.target.value }))} rows={4} />
            </div>
            <Button onClick={handleSaveEdit} className="w-full">Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
