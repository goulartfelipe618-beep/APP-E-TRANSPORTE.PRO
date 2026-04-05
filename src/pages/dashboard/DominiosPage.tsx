import { useCallback, useEffect, useState } from "react";
import { Globe, Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Tables } from "@/integrations/supabase/types";

type DominioRow = Tables<"dominios_usuario">;

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  ativo: "Ativo",
  em_configuracao: "Em configuração",
  cancelado: "Cancelado",
};

function normalizeFqdn(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

export default function DominiosPage() {
  const [rows, setRows] = useState<DominioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fqdnDraft, setFqdnDraft] = useState("");
  const [obsDraft, setObsDraft] = useState("");

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("dominios_usuario")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Não foi possível carregar os domínios.", { description: error.message });
      setRows([]);
    } else {
      setRows((data as DominioRow[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveNovo = async () => {
    const fqdn = normalizeFqdn(fqdnDraft);
    if (!fqdn || !fqdn.includes(".")) {
      toast.error("Informe um domínio válido (ex.: suaempresa.com.br)");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão expirada.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("dominios_usuario").insert({
      user_id: user.id,
      fqdn,
      status: "pendente",
      observacoes: obsDraft.trim() || null,
    });
    setSaving(false);
    if (error) {
      if (error.code === "23505") {
        toast.error("Este domínio já está na sua lista.");
      } else {
        toast.error("Erro ao registrar: " + error.message);
      }
      return;
    }
    toast.success("Solicitação registrada. A equipe dará sequência à compra/configuração.");
    setDialogOpen(false);
    setFqdnDraft("");
    setObsDraft("");
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Globe className="h-7 w-7 text-primary" />
            Domínios
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Compre e gerencie seus domínios. Os domínios ativos aparecem na etapa &quot;Escolha seu domínio&quot; do fluxo
            Website.
          </p>
        </div>
        <Button type="button" onClick={() => setDialogOpen(true)} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Registrar novo domínio
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            Nenhum domínio cadastrado. Use &quot;Registrar novo domínio&quot; para iniciar uma solicitação de compra.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domínio</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead className="hidden md:table-cell">Observações</TableHead>
                <TableHead className="w-40 text-right">Registrado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-foreground">{r.fqdn}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "ativo" ? "default" : "secondary"}>
                      {STATUS_LABEL[r.status] || r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-[280px] truncate">
                    {r.observacoes || "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar novo domínio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dom-fqdn">Domínio desejado</Label>
              <Input
                id="dom-fqdn"
                value={fqdnDraft}
                onChange={(e) => setFqdnDraft(e.target.value)}
                placeholder="www.suaempresa.com.br"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Informe o nome completo. A equipe confirmará disponibilidade e valores.
              </p>
            </div>
            <div>
              <Label htmlFor="dom-obs">Observações (opcional)</Label>
              <Textarea
                id="dom-obs"
                value={obsDraft}
                onChange={(e) => setObsDraft(e.target.value)}
                placeholder="Preferência de extensão .com.br, marca, etc."
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSaveNovo()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando…
                </>
              ) : (
                "Enviar solicitação"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
