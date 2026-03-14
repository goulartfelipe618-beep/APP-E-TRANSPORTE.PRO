import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, ExternalLink, Eye, ImageIcon } from "lucide-react";

interface Template {
  id: string;
  nome: string;
  imagem_url: string;
  link_modelo: string;
  ordem: number;
  ativo: boolean;
  created_at: string;
}

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form
  const [nome, setNome] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");
  const [linkModelo, setLinkModelo] = useState("");
  const [ordem, setOrdem] = useState(0);
  const [ativo, setAtivo] = useState(true);

  const fetchTemplates = async () => {
    const { data, error } = await (supabase
      .from("templates_website" as any)
      .select("*")
      .order("ordem", { ascending: true }) as any);
    if (!error && data) setTemplates(data);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const resetForm = () => {
    setNome("");
    setImagemUrl("");
    setLinkModelo("");
    setOrdem(0);
    setAtivo(true);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditingId(t.id);
    setNome(t.nome);
    setImagemUrl(t.imagem_url);
    setLinkModelo(t.link_modelo || "");
    setOrdem(t.ordem);
    setAtivo(t.ativo);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!imagemUrl.trim()) { toast.error("URL da imagem é obrigatória"); return; }

    if (editingId) {
      const { error } = await (supabase.from("templates_website" as any).update({
        nome, imagem_url: imagemUrl, link_modelo: linkModelo, ordem, ativo, updated_at: new Date().toISOString(),
      } as any).eq("id", editingId) as any);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Template atualizado!");
    } else {
      const { error } = await (supabase.from("templates_website" as any).insert({
        nome, imagem_url: imagemUrl, link_modelo: linkModelo, ordem, ativo,
      } as any) as any);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Template criado!");
    }
    setDialogOpen(false);
    resetForm();
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    const { error } = await (supabase.from("templates_website" as any).delete().eq("id", id) as any);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Template excluído!");
    fetchTemplates();
  };

  const toggleAtivo = async (t: Template) => {
    const { error } = await (supabase.from("templates_website" as any).update({ ativo: !t.ativo } as any).eq("id", t.id) as any);
    if (error) { toast.error("Erro: " + error.message); return; }
    fetchTemplates();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Templates de Website</h1>
          <p className="text-muted-foreground text-sm">Gerencie os modelos disponíveis para os usuários</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Template
        </Button>
      </div>

      {/* Preview cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => (
          <Card key={t.id} className="overflow-hidden group relative">
            <div className="relative h-48 overflow-hidden bg-muted">
              {t.imagem_url ? (
                <div className="h-48 overflow-hidden">
                  <img
                    src={t.imagem_url}
                    alt={t.nome}
                    className="w-full object-cover object-top transition-transform duration-[3s] ease-linear group-hover:translate-y-[calc(-100%+12rem)]"
                    style={{ minHeight: "200%" }}
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                </div>
              )}
              {!t.ativo && (
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                  <Badge variant="secondary">Inativo</Badge>
                </div>
              )}
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-sm">{t.nome}</h3>
                <Badge variant="outline" className="text-xs">#{t.ordem}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {t.link_modelo && (
                  <a href={t.link_modelo} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-1 text-xs">
                      <Eye className="h-3 w-3" /> Ver modelo
                    </Button>
                  </a>
                )}
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => openEdit(t)}>
                  <Pencil className="h-3 w-3" /> Editar
                </Button>
                <Button variant="destructive" size="sm" className="gap-1 text-xs" onClick={() => handleDelete(t.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {!loading && templates.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum template cadastrado. Clique em "Novo Template" para começar.
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Nome do modelo <span className="text-destructive">*</span></label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Executive Dark Premium" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">URL da imagem (screenshot longo) <span className="text-destructive">*</span></label>
              <Input value={imagemUrl} onChange={e => setImagemUrl(e.target.value)} placeholder="https://..." className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Use uma imagem alta (full-page screenshot) para o efeito de scroll ao passar o mouse.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Link para ver o modelo</label>
              <Input value={linkModelo} onChange={e => setLinkModelo(e.target.value)} placeholder="https://exemplo.com" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">Ordem</label>
                <Input type="number" value={ordem} onChange={e => setOrdem(Number(e.target.value))} className="mt-1" />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={ativo} onCheckedChange={setAtivo} />
                <span className="text-sm text-foreground">Ativo</span>
              </div>
            </div>
            {imagemUrl && (
              <div className="rounded-lg border border-border overflow-hidden h-32 group">
                <img
                  src={imagemUrl}
                  alt="Preview"
                  className="w-full object-cover object-top transition-transform duration-[3s] ease-linear group-hover:translate-y-[calc(-100%+8rem)]"
                  style={{ minHeight: "200%" }}
                />
              </div>
            )}
            <Button onClick={handleSave} className="w-full">{editingId ? "Salvar Alterações" : "Criar Template"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
