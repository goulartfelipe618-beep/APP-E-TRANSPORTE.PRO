import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Plus, Search, Trash2, Pencil, StickyNote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Anotacao {
  id: string;
  titulo: string;
  conteudo: string;
  created_at: string;
  updated_at: string;
}

export default function AnotacoesPage() {
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");

  const fetchAnotacoes = async () => {
    const { data, error } = await supabase
      .from("anotacoes" as any)
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar anotações");
    } else {
      setAnotacoes((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAnotacoes(); }, []);

  const handleSave = async () => {
    if (!titulo.trim()) { toast.error("Título obrigatório"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Usuário não autenticado"); return; }

    if (editingId) {
      const { error } = await supabase
        .from("anotacoes" as any)
        .update({ titulo, conteudo, updated_at: new Date().toISOString() } as any)
        .eq("id", editingId);
      if (error) toast.error("Erro ao atualizar"); else toast.success("Anotação atualizada");
    } else {
      const { error } = await supabase
        .from("anotacoes" as any)
        .insert({ titulo, conteudo, user_id: user.id } as any);
      if (error) toast.error("Erro ao criar"); else toast.success("Anotação criada");
    }
    setDialogOpen(false);
    setTitulo("");
    setConteudo("");
    setEditingId(null);
    fetchAnotacoes();
  };

  const handleEdit = (a: Anotacao) => {
    setEditingId(a.id);
    setTitulo(a.titulo);
    setConteudo(a.conteudo);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("anotacoes" as any).delete().eq("id", id);
    if (error) toast.error("Erro ao excluir"); else { toast.success("Excluída"); fetchAnotacoes(); }
  };

  const filtered = anotacoes.filter(a =>
    a.titulo.toLowerCase().includes(search.toLowerCase()) ||
    a.conteudo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Anotações</h1>
          <p className="text-muted-foreground">Crie e gerencie suas anotações</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchAnotacoes}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button className="bg-primary text-primary-foreground" onClick={() => { setEditingId(null); setTitulo(""); setConteudo(""); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Nova Anotação
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar anotação..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <StickyNote className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">Nenhuma anotação encontrada</p>
          <p className="text-sm">Clique em "Nova Anotação" para começar</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(a => (
            <Card key={a.id} className="group relative hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold line-clamp-1">{a.titulo}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">{a.conteudo || "Sem conteúdo"}</p>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(a)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(a.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Anotação" : "Nova Anotação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Título" value={titulo} onChange={e => setTitulo(e.target.value)} />
            <Textarea placeholder="Conteúdo da anotação..." className="min-h-[200px]" value={conteudo} onChange={e => setConteudo(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editingId ? "Salvar" : "Criar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
