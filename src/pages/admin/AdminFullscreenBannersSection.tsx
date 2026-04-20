import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { assertUploadMagicBytes, extensionForDetectedMime } from "@/lib/validateUploadMagicBytes";
import { PAGINAS_MOTORISTA, PAGINAS_TAXI } from "@/lib/painelAvisosPages";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

type Row = Tables<"admin_fullscreen_banners">;

function todayLocalISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isInFullscreenDateRange(inicio: string, fim: string): boolean {
  const today = todayLocalISODate();
  return today >= inicio && today <= fim;
}

const emptyForm = () => ({
  imagem_url: "",
  incluir_motorista: true,
  incluir_taxi: false,
  paginas_motorista: [] as string[],
  paginas_taxi: [] as string[],
  data_inicio: "",
  data_fim: "",
  ativo: true,
});

export default function AdminFullscreenBannersSection() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(() => emptyForm());
  const [file, setFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_fullscreen_banners")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar banners");
      console.error(error);
    } else {
      setRows((data || []) as Row[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFile(null);
    setDialogOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    setForm({
      imagem_url: row.imagem_url,
      incluir_motorista: row.incluir_motorista,
      incluir_taxi: row.incluir_taxi,
      paginas_motorista: [...(row.paginas_motorista || [])],
      paginas_taxi: [...(row.paginas_taxi || [])],
      data_inicio: row.data_inicio,
      data_fim: row.data_fim,
      ativo: row.ativo,
    });
    setFile(null);
    setDialogOpen(true);
  };

  const togglePage = (kind: "motorista" | "taxi", value: string) => {
    const key = kind === "motorista" ? "paginas_motorista" : "paginas_taxi";
    setForm((f) => {
      const arr = f[key];
      const has = arr.includes(value);
      return {
        ...f,
        [key]: has ? arr.filter((x) => x !== value) : [...arr, value],
      };
    });
  };

  const uploadImage = async (f: File): Promise<string | null> => {
    let ext = "jpg";
    try {
      const { mime } = await assertUploadMagicBytes(f, "raster-image", 8 * 1024 * 1024);
      ext = extensionForDetectedMime(mime);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ficheiro inválido");
      return null;
    }
    const path = `banners/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("fullscreen-banners").upload(path, f, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      toast.error("Erro no upload: " + error.message);
      return null;
    }
    const { data: pub } = supabase.storage.from("fullscreen-banners").getPublicUrl(path);
    return pub.publicUrl;
  };

  const validate = (): string | null => {
    if (!editing && !file && !form.imagem_url.trim()) return "Envie uma imagem obrigatória.";
    if (!form.incluir_motorista && !form.incluir_taxi) {
      return "Selecione pelo menos um tipo de utilizador (Motorista ou Taxista).";
    }
    if (form.incluir_motorista && form.paginas_motorista.length === 0) {
      return "Selecione ao menos uma página do painel motorista.";
    }
    if (form.incluir_taxi && form.paginas_taxi.length === 0) {
      return "Selecione ao menos uma página do painel táxi.";
    }
    if (!form.data_inicio || !form.data_fim) return "Informe data inicial e final.";
    if (form.data_fim < form.data_inicio) return "A data final não pode ser anterior à inicial.";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    let imagemUrl = form.imagem_url.trim();
    if (file) {
      setUploading(true);
      const up = await uploadImage(file);
      setUploading(false);
      if (!up) {
        setSaving(false);
        return;
      }
      imagemUrl = up;
    }

    const payload = {
      imagem_url: imagemUrl,
      incluir_motorista: form.incluir_motorista,
      incluir_taxi: form.incluir_taxi,
      paginas_motorista: form.paginas_motorista,
      paginas_taxi: form.paginas_taxi,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim,
      ativo: form.ativo,
      updated_at: new Date().toISOString(),
    };

    if (editing) {
      const { error } = await supabase.from("admin_fullscreen_banners").update(payload).eq("id", editing.id);
      if (error) toast.error("Erro ao atualizar");
      else {
        toast.success("Banner atualizado");
        setDialogOpen(false);
        void fetchRows();
      }
    } else {
      const { error } = await supabase.from("admin_fullscreen_banners").insert(payload);
      if (error) toast.error("Erro ao criar");
      else {
        toast.success("Banner criado");
        setDialogOpen(false);
        void fetchRows();
      }
    }
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("admin_fullscreen_banners").delete().eq("id", deleteTarget.id);
      if (error) toast.error("Erro ao remover");
      else {
        toast.success("Banner removido");
        setDeleteTarget(null);
        void fetchRows();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-4 border-t border-border pt-8 mt-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ImagePlus className="h-6 w-6 text-primary" />
            Banners em tela cheia
          </h2>
          <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
            Área de exibição ~560×400 px (centralizada; imagens maiores são reduzidas). Defina páginas, público e período — só aparece se a data de hoje estiver entre a inicial e a final (inclusive). Os utilizadores podem
            fechar com animação; a partir da 3.ª exibição surge a opção «Não mostrar novamente».
          </p>
        </div>
        <Button onClick={openCreate} variant="secondary">
          <Plus className="h-4 w-4 mr-2" />
          Novo banner
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando banners…
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">Nenhum banner em tela cheia.</Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const inPeriod = isInFullscreenDateRange(r.data_inicio, r.data_fim);
            return (
            <Card key={r.id} className="p-4 flex flex-wrap items-start gap-4">
              <div className="h-20 w-28 shrink-0 overflow-hidden rounded-md border bg-muted">
                {r.imagem_url ? (
                  <img src={r.imagem_url} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={cn("rounded px-2 py-0.5", r.ativo ? "bg-primary/15 text-primary" : "bg-muted")}>
                    {r.ativo ? "Ativo" : "Inativo"}
                  </span>
                  {r.ativo && !inPeriod ? (
                    <span className="rounded border border-amber-500/40 bg-amber-950/40 px-2 py-0.5 text-amber-200/95">
                      Fora do período
                    </span>
                  ) : null}
                  {r.incluir_motorista && (
                    <span className="rounded border border-border px-2 py-0.5">Motorista</span>
                  )}
                  {r.incluir_taxi && <span className="rounded border border-border px-2 py-0.5">Táxi</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.data_inicio} → {r.data_fim}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="icon" onClick={() => openEdit(r)} title="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setDeleteTarget(r)} title="Excluir">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>{editing ? "Editar banner em tela cheia" : "Novo banner em tela cheia"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-8rem)] px-6">
            <div className="space-y-4 pr-4 pb-4">
              <div className="space-y-2">
                <Label>Imagem (obrigatório — recomendado ~560×400 px ou proporção semelhante)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {editing?.imagem_url && !file ? (
                  <p className="text-xs text-muted-foreground">Imagem atual mantida se não escolher outro ficheiro.</p>
                ) : null}
              </div>

              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Público</p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="fs-pub-m"
                    checked={form.incluir_motorista}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, incluir_motorista: v === true }))}
                  />
                  <Label htmlFor="fs-pub-m" className="font-normal cursor-pointer">
                    Motorista executivo
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="fs-pub-t"
                    checked={form.incluir_taxi}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, incluir_taxi: v === true }))}
                  />
                  <Label htmlFor="fs-pub-t" className="font-normal cursor-pointer">
                    Taxista
                  </Label>
                </div>
              </div>

              {form.incluir_motorista && (
                <div className="space-y-2">
                  <Label>Páginas — Motorista</Label>
                  <div className="rounded-md border border-border p-3 max-h-40 overflow-y-auto space-y-2">
                    {PAGINAS_MOTORISTA.map((p) => (
                      <div key={p.value} className="flex items-center gap-2">
                        <Checkbox
                          id={`fs-m-${p.value}`}
                          checked={form.paginas_motorista.includes(p.value)}
                          onCheckedChange={() => togglePage("motorista", p.value)}
                        />
                        <Label htmlFor={`fs-m-${p.value}`} className="font-normal text-sm cursor-pointer leading-tight">
                          {p.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {form.incluir_taxi && (
                <div className="space-y-2">
                  <Label>Páginas — Táxi</Label>
                  <div className="rounded-md border border-border p-3 max-h-40 overflow-y-auto space-y-2">
                    {PAGINAS_TAXI.map((p) => (
                      <div key={p.value} className="flex items-center gap-2">
                        <Checkbox
                          id={`fs-t-${p.value}`}
                          checked={form.paginas_taxi.includes(p.value)}
                          onCheckedChange={() => togglePage("taxi", p.value)}
                        />
                        <Label htmlFor={`fs-t-${p.value}`} className="font-normal text-sm cursor-pointer leading-tight">
                          {p.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fs-data-ini">Data inicial</Label>
                  <Input
                    id="fs-data-ini"
                    type="date"
                    value={form.data_inicio}
                    onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fs-data-fim">Data final</Label>
                  <Input
                    id="fs-data-fim"
                    type="date"
                    value={form.data_fim}
                    onChange={(e) => setForm((f) => ({ ...f, data_fim: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label htmlFor="fs-ativo">Ativo</Label>
                <Switch
                  id="fs-ativo"
                  checked={form.ativo}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-6 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving || uploading}>
              {saving || uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remover banner?"
        description="O banner deixará de ser exibido para todos os utilizadores."
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
