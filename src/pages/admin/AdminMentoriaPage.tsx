import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, GraduationCap, Pencil, Upload, Video, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

interface MentoriaCard {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  imagem_url: string;
  video_url: string;
  materiais: string;
  link_url: string | null;
  ordem: number;
  ativo: boolean;
}

const emptyCard = { titulo: "", descricao: "", imagem_url: "", video_url: "", materiais: "", link_url: "", tipo: "conteudo", ordem: 0 };

export default function AdminMentoriaPage() {
  const [cards, setCards] = useState<MentoriaCard[]>([]);
  const [form, setForm] = useState(emptyCard);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCards = async () => {
    const { data } = await (supabase.from("mentoria_cards" as any).select("*").order("tipo").order("ordem", { ascending: true }) as any);
    if (data) setCards(data);
  };

  useEffect(() => { fetchCards(); }, []);

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("mentoria").upload(path, file);
    if (error) { toast.error(`Erro no upload: ${error.message}`); return null; }
    const { data: urlData } = supabase.storage.from("mentoria").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    const url = await uploadFile(file, "videos");
    if (url) setForm(prev => ({ ...prev, video_url: url }));
    setUploadingVideo(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const url = await uploadFile(file, "capas");
    if (url) setForm(prev => ({ ...prev, imagem_url: url }));
    setUploadingImage(false);
  };

  const handleSave = async () => {
    if (!form.titulo.trim() || !form.imagem_url.trim()) {
      toast.error("Título e imagem de capa são obrigatórios");
      return;
    }
    const payload = { ...form, link_url: form.link_url || null };

    if (editingId) {
      const { error } = await (supabase.from("mentoria_cards" as any).update(payload).eq("id", editingId) as any);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Card atualizado!");
    } else {
      const { error } = await (supabase.from("mentoria_cards" as any).insert(payload) as any);
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Card criado!");
    }
    setForm(emptyCard);
    setEditingId(null);
    setOpen(false);
    fetchCards();
  };

  const confirmDeleteCard = async () => {
    if (!deleteCardId) return;
    setDeleteLoading(true);
    try {
      const { error } = await (supabase.from("mentoria_cards" as any).delete().eq("id", deleteCardId) as any);
      if (error) {
        toast.error("Erro ao excluir");
        return;
      }
      toast.success("Card excluído!");
      setDeleteCardId(null);
      fetchCards();
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggle = async (id: string, ativo: boolean) => {
    await (supabase.from("mentoria_cards" as any).update({ ativo: !ativo }).eq("id", id) as any);
    fetchCards();
  };

  const openEdit = (card: MentoriaCard) => {
    setForm({
      titulo: card.titulo,
      descricao: card.descricao || "",
      imagem_url: card.imagem_url,
      video_url: card.video_url || "",
      materiais: card.materiais || "",
      link_url: card.link_url || "",
      tipo: card.tipo,
      ordem: card.ordem,
    });
    setEditingId(card.id);
    setOpen(true);
  };

  const sobreCards = cards.filter(c => c.tipo === "sobre_sistema");
  const conteudoCards = cards.filter(c => c.tipo === "conteudo");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" /> Mentoria — Gerenciar Cards
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie os cards com vídeos exibidos na página de Mentoria dos motoristas.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyCard); setEditingId(null); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Novo Card</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Card" : "Novo Card"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Categoria */}
              <div>
                <label className="text-sm font-medium text-foreground">Categoria</label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sobre_sistema">Sobre o Sistema (cards pequenos 1080×760)</SelectItem>
                    <SelectItem value="conteudo">Conteúdo (cards grandes 1080×1350)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Título */}
              <div>
                <label className="text-sm font-medium text-foreground">Título *</label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Nome do conteúdo" />
              </div>

              {/* Descrição */}
              <div>
                <label className="text-sm font-medium text-foreground">Descrição</label>
                <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição do vídeo" rows={3} />
              </div>

              {/* Imagem de Capa (upload) */}
              <div>
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" /> Imagem de Capa *
                </label>
                <Button type="button" variant="outline" className="w-full mt-1 gap-2" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}>
                  {uploadingImage ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><Upload className="h-4 w-4" /> {form.imagem_url ? "Trocar Imagem" : "Fazer Upload da Imagem"}</>}
                </Button>
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                {form.imagem_url && (
                  <img src={form.imagem_url} alt="Preview" className="mt-2 rounded-lg max-h-32 object-cover border border-border" />
                )}
              </div>

              {/* Vídeo (upload) */}
              <div>
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Video className="h-4 w-4" /> Vídeo do Conteúdo
                </label>
                <Button type="button" variant="outline" className="w-full mt-1 gap-2" onClick={() => videoInputRef.current?.click()} disabled={uploadingVideo}>
                  {uploadingVideo ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando vídeo...</> : <><Upload className="h-4 w-4" /> {form.video_url ? "Trocar Vídeo" : "Fazer Upload do Vídeo"}</>}
                </Button>
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                {form.video_url && (
                  <p className="text-xs text-emerald-500 mt-1">✅ Vídeo carregado</p>
                )}
              </div>

              {/* Materiais */}
              <div>
                <label className="text-sm font-medium text-foreground">Materiais Utilizados</label>
                <Textarea value={form.materiais} onChange={(e) => setForm({ ...form, materiais: e.target.value })} placeholder="Links, ferramentas, documentos utilizados no vídeo..." rows={3} />
              </div>

              {/* Ordem */}
              <div>
                <label className="text-sm font-medium text-foreground">Ordem</label>
                <Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} />
              </div>

              <Button onClick={handleSave} className="w-full">{editingId ? "Salvar Alterações" : "Criar Card"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sobre o Sistema */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Sobre o Sistema <Badge variant="secondary">{sobreCards.length}</Badge></h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sobreCards.map((card) => (
            <Card key={card.id} className={!card.ativo ? "opacity-50" : ""}>
              <div className="relative" style={{ aspectRatio: "1080/760" }}>
                <img src={card.imagem_url} alt={card.titulo} className="w-full h-full object-cover rounded-t-lg" />
                {card.video_url && (
                  <Badge className="absolute top-2 right-2 bg-primary/90 text-primary-foreground text-[10px] gap-1">
                    <Video className="h-3 w-3" /> Vídeo
                  </Badge>
                )}
              </div>
              <CardContent className="p-3 space-y-2">
                <p className="font-semibold text-sm text-foreground truncate">{card.titulo}</p>
                <div className="flex items-center justify-between">
                  <Switch checked={card.ativo} onCheckedChange={() => handleToggle(card.id, card.ativo)} />
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(card)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteCardId(card.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Conteúdos */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Conteúdos <Badge variant="secondary">{conteudoCards.length}</Badge></h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {conteudoCards.map((card) => (
            <Card key={card.id} className={!card.ativo ? "opacity-50" : ""}>
              <div className="relative" style={{ aspectRatio: "1080/1350" }}>
                <img src={card.imagem_url} alt={card.titulo} className="w-full h-full object-cover rounded-t-lg" />
                {card.video_url && (
                  <Badge className="absolute top-2 right-2 bg-primary/90 text-primary-foreground text-[10px] gap-1">
                    <Video className="h-3 w-3" /> Vídeo
                  </Badge>
                )}
              </div>
              <CardContent className="p-3 space-y-2">
                <p className="font-semibold text-xs text-foreground truncate">{card.titulo}</p>
                <div className="flex items-center justify-between">
                  <Switch checked={card.ativo} onCheckedChange={() => handleToggle(card.id, card.ativo)} />
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(card)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteCardId(card.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <ConfirmDeleteDialog
        open={deleteCardId !== null}
        onOpenChange={(o) => !o && setDeleteCardId(null)}
        title="Excluir card de mentoria?"
        description="O conteúdo será removido permanentemente. Deseja continuar?"
        onConfirm={confirmDeleteCard}
        loading={deleteLoading}
      />
    </div>
  );
}
