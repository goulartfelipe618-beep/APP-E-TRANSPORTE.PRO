import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Slide {
  id: string;
  user_id: string;
  titulo: string;
  subtitulo: string;
  imagem_url: string;
  ordem: number;
  ativo: boolean;
  pagina: string;
  created_at: string;
  mostrar_texto: boolean;
}

/** Banner do topo da página Comunidade (obrigatório para imagens enviadas por arquivo). */
const COMUNIDADE_BANNER_W = 1922;
const COMUNIDADE_BANNER_H = 330;

const PAGINAS = [
  { value: "home", label: "Home (Motorista)" },
  { value: "home_taxi", label: "Home (Taxista)" },
  { value: "geolocalizacao", label: "Geolocalização" },
  { value: "google", label: "Google" },
  { value: "email_business", label: "E-mail Business" },
  { value: "website", label: "Website" },
  { value: "disparador", label: "Disparador" },
  { value: "mentoria", label: "Mentoria" },
  { value: "empty_legs", label: "Empty Legs" },
  { value: "comunidade", label: "Comunidade" },
];

function getImageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      reject(new Error("Não foi possível ler a imagem"));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export default function SlidesPage() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Slide | null>(null);
  const [form, setForm] = useState({ titulo: "", subtitulo: "", imagem_url: "", mostrar_texto: false, link_url: "" });
  const [uploading, setUploading] = useState(false);
  const [paginaSelecionada, setPaginaSelecionada] = useState("home");

  const fetchSlides = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("slides")
      .select("*")
      .eq("user_id", user.id)
      .eq("pagina", paginaSelecionada)
      .order("ordem", { ascending: true });
    setSlides((data as Slide[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchSlides(); }, [paginaSelecionada]);

  const openCreate = () => {
    setEditing(null);
    setForm({ titulo: "", subtitulo: "", imagem_url: "", mostrar_texto: false, link_url: "" });
    setDialogOpen(true);
  };

  const openEdit = (s: Slide) => {
    setEditing(s);
    setForm({ titulo: s.titulo, subtitulo: s.subtitulo, imagem_url: s.imagem_url, mostrar_texto: s.mostrar_texto, link_url: (s as any).link_url || "" });
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (paginaSelecionada === "comunidade") {
      try {
        const dims = await getImageDimensions(file);
        if (dims.width !== COMUNIDADE_BANNER_W || dims.height !== COMUNIDADE_BANNER_H) {
          toast.error(
            `O banner da Comunidade deve ter exatamente ${COMUNIDADE_BANNER_W}×${COMUNIDADE_BANNER_H}px (recebido: ${dims.width}×${dims.height}).`,
          );
          e.target.value = "";
          return;
        }
      } catch {
        toast.error("Não foi possível validar a imagem.");
        e.target.value = "";
        return;
      }
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `slides/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (error) {
      toast.error("Erro ao enviar imagem");
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
    setForm((f) => ({ ...f, imagem_url: urlData.publicUrl }));
    setUploading(false);
    toast.success("Imagem enviada!");
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editing) {
      const { error } = await supabase.from("slides").update({
        titulo: form.titulo,
        subtitulo: form.subtitulo,
        imagem_url: form.imagem_url,
        mostrar_texto: form.mostrar_texto,
        link_url: form.link_url,
        updated_at: new Date().toISOString(),
      }).eq("id", editing.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Slide atualizado!");
    } else {
      const maxOrdem = slides.length > 0 ? Math.max(...slides.map((s) => s.ordem)) + 1 : 0;
      const { error } = await supabase.from("slides").insert({
        user_id: user.id,
        titulo: form.titulo,
        subtitulo: form.subtitulo,
        imagem_url: form.imagem_url,
        mostrar_texto: form.mostrar_texto,
        link_url: form.link_url,
        ordem: maxOrdem,
        pagina: paginaSelecionada,
      });
      if (error) { toast.error("Erro ao criar slide"); return; }
      toast.success("Slide criado!");
    }
    setDialogOpen(false);
    fetchSlides();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("slides").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Slide excluído!");
    fetchSlides();
  };

  const handleToggle = async (s: Slide) => {
    await supabase.from("slides").update({ ativo: !s.ativo }).eq("id", s.id);
    fetchSlides();
  };

  const moveSlide = async (s: Slide, direction: "up" | "down") => {
    const idx = slides.findIndex((sl) => sl.id === s.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= slides.length) return;
    const other = slides[swapIdx];
    await Promise.all([
      supabase.from("slides").update({ ordem: other.ordem }).eq("id", s.id),
      supabase.from("slides").update({ ordem: s.ordem }).eq("id", other.id),
    ]);
    fetchSlides();
  };

  const paginaAtual = PAGINAS.find((p) => p.value === paginaSelecionada);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gerenciar Slides</h1>
          <p className="text-muted-foreground text-sm">
            Editando slides da página: <span className="font-semibold text-primary">{paginaAtual?.label}</span>
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo Slide</Button>
      </div>

      {/* Page selector tabs */}
      <div className="flex gap-2 flex-wrap">
        {PAGINAS.map((p) => (
          <Button
            key={p.value}
            variant={paginaSelecionada === p.value ? "default" : "outline"}
            size="sm"
            onClick={() => setPaginaSelecionada(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Ordem</TableHead>
              <TableHead className="w-20">Preview</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Subtítulo</TableHead>
              <TableHead className="w-20">Ativo</TableHead>
              <TableHead className="w-40 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : slides.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum slide cadastrado para "{paginaAtual?.label}". Clique em "Novo Slide" para começar.</TableCell></TableRow>
            ) : slides.map((s, i) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveSlide(s, "up")} disabled={i === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveSlide(s, "down")} disabled={i === slides.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
                <TableCell>
                  {s.imagem_url ? (
                    <img src={s.imagem_url} alt={s.titulo} className="h-10 w-16 rounded object-cover" />
                  ) : (
                    <div className="h-10 w-16 rounded bg-muted flex items-center justify-center"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>
                  )}
                </TableCell>
                <TableCell className="font-medium text-foreground">{s.titulo}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{s.subtitulo}</TableCell>
                <TableCell><Switch checked={s.ativo} onCheckedChange={() => handleToggle(s)} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Slide" : `Novo Slide — ${paginaAtual?.label}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Mostrar textos sobre a imagem</Label>
              <Switch checked={form.mostrar_texto} onCheckedChange={(v) => setForm((f) => ({ ...f, mostrar_texto: v }))} />
            </div>
            {form.mostrar_texto && (
              <>
                <div>
                  <Label>Título (opcional)</Label>
                  <Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Impulsione seu Transporte Executivo" />
                </div>
                <div>
                  <Label>Subtítulo (opcional)</Label>
                  <Input value={form.subtitulo} onChange={(e) => setForm((f) => ({ ...f, subtitulo: e.target.value }))} placeholder="Ex: Gerencie sua frota com tecnologia de ponta" />
                </div>
              </>
            )}
            <div>
              <Label>Imagem</Label>
              {paginaSelecionada === "comunidade" && (
                <p className="mb-2 text-xs text-muted-foreground">
                  Banner da Comunidade: envie arquivos com dimensões exatas de{" "}
                  <span className="font-mono text-foreground">
                    {COMUNIDADE_BANNER_W} × {COMUNIDADE_BANNER_H} px
                  </span>
                  . Outras medidas serão recusadas.
                </p>
              )}
              {form.imagem_url && (
                <img
                  src={form.imagem_url}
                  alt="Preview"
                  className={cn(
                    "mb-2 w-full rounded-lg object-cover",
                    paginaSelecionada === "comunidade" ? "aspect-[1922/330] max-h-40" : "h-32",
                  )}
                />
              )}
              <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
              {uploading && <p className="text-xs text-muted-foreground mt-1">Enviando...</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {paginaSelecionada === "comunidade"
                  ? "Ou cole a URL de uma imagem já hospedada nessas dimensões:"
                  : "Ou cole a URL da imagem diretamente:"}
              </p>
              <Input value={form.imagem_url} onChange={(e) => setForm((f) => ({ ...f, imagem_url: e.target.value }))} placeholder="https://..." className="mt-1" />
            </div>
            <div>
              <Label>Link de redirecionamento (opcional)</Label>
              <Input value={form.link_url} onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))} placeholder="https://exemplo.com (ao clicar na imagem)" />
            </div>
            <Button onClick={handleSave} className="w-full">{editing ? "Salvar Alterações" : "Criar Slide"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
