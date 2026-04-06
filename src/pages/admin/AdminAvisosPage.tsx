import { useCallback, useEffect, useState } from "react";
import { Megaphone, Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { PAGINAS_MOTORISTA, PAGINAS_TAXI } from "@/lib/painelAvisosPages";
import {
  AVISO_FONTE_LABELS,
  AVISO_FONTE_VALUES,
  avisoFonteClassName,
  isAvisoFonte,
  type AvisoFonte,
} from "@/lib/painelAvisoEstilo";
import { isMissingFonteColumnError } from "@/lib/painelAvisoPersist";
import { renderAvisoTextoComMarcacao } from "@/lib/painelAvisoTexto";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import AdminFullscreenBannersSection from "@/pages/admin/AdminFullscreenBannersSection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Aviso = Tables<"admin_avisos_plataforma">;

const CORES: { value: "verde" | "amarelo" | "vermelho"; label: string; sample: string }[] = [
  { value: "verde", label: "Verde", sample: "bg-emerald-600" },
  { value: "amarelo", label: "Amarelo", sample: "bg-amber-400" },
  { value: "vermelho", label: "Vermelho", sample: "bg-red-600" },
];

const emptyForm = () => ({
  texto: "",
  cor: "amarelo" as const,
  fonte: "padrao" as AvisoFonte,
  escopo_global: false,
  incluir_motorista: true,
  incluir_taxi: true,
  incluir_login: false,
  paginas_motorista: [] as string[],
  paginas_taxi: [] as string[],
  ativo: true,
});

export default function AdminAvisosPage() {
  const [rows, setRows] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Aviso | null>(null);
  const [form, setForm] = useState(() => emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<Aviso | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_avisos_plataforma")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar avisos");
      console.error(error);
    } else {
      setRows((data || []) as Aviso[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (row: Aviso) => {
    setEditing(row);
    setForm({
      texto: row.texto,
      cor: row.cor as "verde" | "amarelo" | "vermelho",
      fonte: isAvisoFonte(row.fonte ?? "") ? row.fonte : "padrao",
      escopo_global: row.escopo_global,
      incluir_motorista: row.incluir_motorista,
      incluir_taxi: row.incluir_taxi,
      incluir_login: row.incluir_login ?? false,
      paginas_motorista: [...(row.paginas_motorista || [])],
      paginas_taxi: [...(row.paginas_taxi || [])],
      ativo: row.ativo,
    });
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

  const validate = (): string | null => {
    if (!form.texto.trim()) return "Informe o texto do aviso.";
    if (!form.incluir_motorista && !form.incluir_taxi && !form.incluir_login) {
      return "Marque pelo menos um público: Motorista executivo, Taxista ou Tela de login.";
    }
    if (!form.escopo_global) {
      if (form.incluir_motorista && form.paginas_motorista.length === 0) {
        return "Selecione ao menos uma página do painel motorista ou marque escopo global.";
      }
      if (form.incluir_taxi && form.paginas_taxi.length === 0) {
        return "Selecione ao menos uma página do painel táxi ou marque escopo global.";
      }
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    const payloadBase = {
      texto: form.texto.trim(),
      cor: form.cor,
      escopo_global: form.escopo_global,
      incluir_motorista: form.incluir_motorista,
      incluir_taxi: form.incluir_taxi,
      incluir_login: form.incluir_login,
      paginas_motorista: form.escopo_global ? [] : form.paginas_motorista,
      paginas_taxi: form.escopo_global ? [] : form.paginas_taxi,
      ativo: form.ativo,
      updated_at: new Date().toISOString(),
    };
    const payloadWithFonte = { ...payloadBase, fonte: form.fonte };

    const errMsg = (e: { message?: string; details?: string; hint?: string }) =>
      [e.message, e.details, e.hint].filter(Boolean).join(" — ") || "Erro desconhecido";

    if (editing) {
      let { error } = await supabase.from("admin_avisos_plataforma").update(payloadWithFonte).eq("id", editing.id);
      if (error && isMissingFonteColumnError(error)) {
        ({ error } = await supabase.from("admin_avisos_plataforma").update(payloadBase).eq("id", editing.id));
        if (!error) {
          toast.success("Aviso atualizado");
          toast.message(
            "A coluna «fonte» ainda não existe no banco. A escolha de fonte não foi salva — execute a migração no Supabase ou rode o SQL da documentação.",
            { duration: 8000 },
          );
        } else {
          console.error(error);
          toast.error(`Erro ao atualizar: ${errMsg(error)}`);
        }
      } else if (error) {
        console.error(error);
        toast.error(`Erro ao atualizar: ${errMsg(error)}`);
      } else {
        toast.success("Aviso atualizado");
      }
      if (!error) {
        setDialogOpen(false);
        void fetchRows();
      }
    } else {
      let { error } = await supabase.from("admin_avisos_plataforma").insert(payloadWithFonte);
      if (error && isMissingFonteColumnError(error)) {
        ({ error } = await supabase.from("admin_avisos_plataforma").insert(payloadBase));
        if (!error) {
          toast.success("Aviso criado");
          toast.message(
            "A coluna «fonte» ainda não existe no banco. A escolha de fonte não foi salva — execute a migração no Supabase ou rode o SQL da documentação.",
            { duration: 8000 },
          );
        } else {
          console.error(error);
          toast.error(`Erro ao criar: ${errMsg(error)}`);
        }
      } else if (error) {
        console.error(error);
        toast.error(`Erro ao criar: ${errMsg(error)}`);
      } else {
        toast.success("Aviso criado");
      }
      if (!error) {
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
      const { error } = await supabase.from("admin_avisos_plataforma").delete().eq("id", deleteTarget.id);
      if (error) toast.error("Erro ao remover");
      else {
        toast.success("Aviso removido");
        setDeleteTarget(null);
        void fetchRows();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="h-7 w-7 text-primary" />
            Avisos
          </h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-xl">
            Mensagens no topo da área de conteúdo dos painéis Motorista executivo e Táxi. Escopo global exibe em todas as
            páginas do público selecionado; caso contrário, apenas nas páginas marcadas. O utilizador pode fechar com{" "}
            <span className="font-medium text-foreground">×</span>.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo aviso
        </Button>
      </div>

      <AdminFullscreenBannersSection />

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando…
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nenhum aviso cadastrado.</Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="p-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-block h-3 w-3 rounded-full",
                      r.cor === "verde" && "bg-emerald-600",
                      r.cor === "amarelo" && "bg-amber-400",
                      r.cor === "vermelho" && "bg-red-600",
                    )}
                  />
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    {r.ativo ? "Ativo" : "Inativo"}
                  </span>
                  {r.escopo_global ? (
                    <span className="text-xs rounded-md bg-primary/15 text-primary px-2 py-0.5">Global</span>
                  ) : (
                    <span className="text-xs rounded-md bg-muted px-2 py-0.5">Páginas específicas</span>
                  )}
                  {r.incluir_motorista && (
                    <span className="text-xs rounded-md border border-border px-2 py-0.5">Motorista</span>
                  )}
                  {r.incluir_taxi && <span className="text-xs rounded-md border border-border px-2 py-0.5">Táxi</span>}
                  {r.incluir_login && <span className="text-xs rounded-md border border-border px-2 py-0.5">Tela de login</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {r.fonte && r.fonte !== "padrao" ? (
                    <span className="rounded border border-border px-1.5 py-0.5">
                      {AVISO_FONTE_LABELS[r.fonte as AvisoFonte] ?? r.fonte}
                    </span>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "text-sm text-foreground whitespace-pre-wrap",
                    avisoFonteClassName(r.fonte ?? "padrao"),
                  )}
                >
                  {renderAvisoTextoComMarcacao(r.texto)}
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
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>{editing ? "Editar aviso" : "Novo aviso"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-8rem)] px-6">
            <div className="space-y-4 pr-4 pb-4">
              <div className="space-y-2">
                <Label htmlFor="aviso-texto">Texto do aviso</Label>
                <p className="text-xs text-muted-foreground">
                  Para destacar em negrito só parte do texto, use <span className="font-mono text-foreground">**assim**</span>{" "}
                  (dois asteriscos antes e depois da expressão).
                </p>
                <Textarea
                  id="aviso-texto"
                  value={form.texto}
                  onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
                  rows={4}
                  placeholder="Ex.: Manutenção programada **hoje às 22h**. Demais horários normais."
                />
              </div>

              <div className="space-y-2">
                <Label>Cor de fundo</Label>
                <div className="flex flex-wrap gap-2">
                  {CORES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, cor: c.value }))}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-colors",
                        form.cor === c.value ? "border-primary ring-2 ring-primary/30" : "border-border hover:bg-muted/50",
                      )}
                    >
                      <span className={cn("h-4 w-4 rounded", c.sample)} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aviso-fonte">Fonte do texto</Label>
                <p className="text-xs text-muted-foreground">Somente para este aviso; não altera o restante do painel.</p>
                <Select
                  value={form.fonte}
                  onValueChange={(v) => setForm((f) => ({ ...f, fonte: v as AvisoFonte }))}
                >
                  <SelectTrigger id="aviso-fonte" className="w-full">
                    <SelectValue placeholder="Fonte" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVISO_FONTE_VALUES.map((key) => (
                      <SelectItem key={key} value={key}>
                        {AVISO_FONTE_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium text-sm">Escopo global</p>
                  <p className="text-xs text-muted-foreground">Todas as páginas do público marcado abaixo.</p>
                </div>
                <Switch
                  checked={form.escopo_global}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, escopo_global: v }))}
                />
              </div>

              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Público</p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pub-m"
                    checked={form.incluir_motorista}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, incluir_motorista: v === true }))}
                  />
                  <Label htmlFor="pub-m" className="font-normal cursor-pointer">
                    Motorista executivo (Gestão de Frota)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pub-t"
                    checked={form.incluir_taxi}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, incluir_taxi: v === true }))}
                  />
                  <Label htmlFor="pub-t" className="font-normal cursor-pointer">
                    Taxista (Gestão de Táxi)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pub-login"
                    checked={form.incluir_login}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, incluir_login: v === true }))}
                  />
                  <Label htmlFor="pub-login" className="font-normal cursor-pointer">
                    Tela de login
                  </Label>
                </div>
              </div>

              {!form.escopo_global && (
                <>
                  {form.incluir_motorista && (
                    <div className="space-y-2">
                      <Label>Páginas — Motorista executivo</Label>
                      <div className="rounded-md border border-border p-3 max-h-48 overflow-y-auto space-y-2">
                        {PAGINAS_MOTORISTA.map((p) => (
                          <div key={p.value} className="flex items-center gap-2">
                            <Checkbox
                              id={`m-${p.value}`}
                              checked={form.paginas_motorista.includes(p.value)}
                              onCheckedChange={() => togglePage("motorista", p.value)}
                            />
                            <Label htmlFor={`m-${p.value}`} className="font-normal text-sm cursor-pointer leading-tight">
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
                      <div className="rounded-md border border-border p-3 max-h-48 overflow-y-auto space-y-2">
                        {PAGINAS_TAXI.map((p) => (
                          <div key={p.value} className="flex items-center gap-2">
                            <Checkbox
                              id={`t-${p.value}`}
                              checked={form.paginas_taxi.includes(p.value)}
                              onCheckedChange={() => togglePage("taxi", p.value)}
                            />
                            <Label htmlFor={`t-${p.value}`} className="font-normal text-sm cursor-pointer leading-tight">
                              {p.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label htmlFor="aviso-ativo">Aviso ativo</Label>
                <Switch
                  id="aviso-ativo"
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
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remover aviso?"
        description="O aviso deixará de ser exibido nos painéis. Esta ação não pode ser desfeita."
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
