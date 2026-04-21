import { useMemo, useState, useCallback } from "react";
import { Plus, RefreshCw, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActivePage } from "@/contexts/ActivePageContext";
import { useFinancialTransactionsPaginated } from "@/hooks/useFinancialTransactions";
import {
  DESPESA_CATEGORY_PRESETS,
  FINANCEIRO_KIND_LABEL,
  FINANCEIRO_ORIGIN_LABEL,
  FINANCEIRO_PAYMENT_METHODS,
  FINANCEIRO_PAYMENT_METHOD_LABEL,
  FINANCEIRO_STATUS_LABEL,
  RECEITA_MANUAL_PRESETS,
  formatBRL,
  type FinancialTransaction,
  type FinanceiroPaymentMethod,
} from "@/lib/financeiroFrota";
import { cn } from "@/lib/utils";

function isoFromDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function FinanceiroLancamentosPage() {
  const { setActivePage } = useActivePage();
  const fromDefault = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 2);
    return isoFromDate(d);
  }, []);
  const toDefault = useMemo(() => isoFromDate(new Date()), []);
  const { rows, loading, error, reload, hasMore, loadMore } = useFinancialTransactionsPaginated(fromDefault, toDefault, 50);

  const [dialogOpen, setDialogOpen] = useState(false);
  /** null = criar novo; definido = editar lançamento manual existente */
  const [editManualRow, setEditManualRow] = useState<FinancialTransaction | null>(null);
  const [editLinkedRow, setEditLinkedRow] = useState<FinancialTransaction | null>(null);
  const [linkedDesc, setLinkedDesc] = useState("");
  const [linkedOccurredOn, setLinkedOccurredOn] = useState("");
  const [linkedCategory, setLinkedCategory] = useState("");
  const [payDialogRow, setPayDialogRow] = useState<FinancialTransaction | null>(null);
  const [payMethod, setPayMethod] = useState<FinanceiroPaymentMethod | "">("");
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<"receita" | "despesa">("despesa");
  const [category, setCategory] = useState("combustivel");
  const [amountStr, setAmountStr] = useState("");
  const [occurredOn, setOccurredOn] = useState(isoFromDate(new Date()));
  const [description, setDescription] = useState("");

  const categoryPresets = kind === "despesa" ? DESPESA_CATEGORY_PRESETS : RECEITA_MANUAL_PRESETS;
  const categoryPresetValues = useMemo(
    () => new Set(categoryPresets.map((c) => c.value)),
    [kind],
  );

  const resetForm = () => {
    setKind("despesa");
    setCategory("combustivel");
    setAmountStr("");
    setOccurredOn(isoFromDate(new Date()));
    setDescription("");
  };

  const openCreateManual = () => {
    resetForm();
    setEditManualRow(null);
    setDialogOpen(true);
  };

  const openEditManual = (row: FinancialTransaction) => {
    if (row.payment_status === "cancelled") {
      toast.error("Lançamento cancelado não pode ser editado.");
      return;
    }
    if (row.origin !== "manual") return;
    setEditManualRow(row);
    setKind(row.kind === "receita" ? "receita" : "despesa");
    setCategory(row.category);
    setAmountStr(String(row.amount));
    setOccurredOn(String(row.occurred_on).slice(0, 10));
    setDescription(row.description ?? "");
    setDialogOpen(true);
  };

  const openEditLinked = (row: FinancialTransaction) => {
    if (row.payment_status === "cancelled") {
      toast.error("Lançamento cancelado não pode ser editado.");
      return;
    }
    if (row.origin === "manual") return;
    setEditLinkedRow(row);
    setLinkedDesc(row.description ?? "");
    setLinkedOccurredOn(String(row.occurred_on).slice(0, 10));
    setLinkedCategory(row.category);
  };

  const handleSaveManual = async () => {
    const amount = Number(String(amountStr).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      toast.error("Sessão inválida.");
      return;
    }
    setSaving(true);
    try {
      if (editManualRow) {
        const { error: upErr } = await supabase
          .from("financial_transactions")
          .update({
            kind,
            amount,
            occurred_on: occurredOn,
            description: description.trim() || null,
            category,
          })
          .eq("id", editManualRow.id);
        if (upErr) {
          toast.error(upErr.message);
          return;
        }
        toast.success("Lançamento atualizado.");
      } else {
        const { error: insErr } = await supabase.from("financial_transactions").insert({
          user_id: uid,
          kind,
          origin: "manual",
          payment_status: "pending",
          amount,
          occurred_on: occurredOn,
          description: description.trim() || null,
          category,
          is_primary: false,
        });
        if (insErr) {
          toast.error(insErr.message);
          return;
        }
        toast.success("Lançamento criado.");
      }
      setDialogOpen(false);
      setEditManualRow(null);
      resetForm();
      void reload();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLinked = async () => {
    const row = editLinkedRow;
    if (!row) return;
    setSaving(true);
    try {
      const { error: upErr } = await supabase
        .from("financial_transactions")
        .update({
          occurred_on: linkedOccurredOn,
          description: linkedDesc.trim() || null,
          category: linkedCategory.trim() || "outro",
        })
        .eq("id", row.id);
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      toast.success("Lançamento atualizado.");
      setEditLinkedRow(null);
      void reload();
    } finally {
      setSaving(false);
    }
  };

  const setPending = useCallback(
    async (row: FinancialTransaction) => {
      if (row.payment_status === "cancelled") {
        toast.error("Lançamento cancelado não pode ser alterado.");
        return;
      }
      const { error: uErr } = await supabase
        .from("financial_transactions")
        .update({ payment_status: "pending", paid_at: null, payment_method: null })
        .eq("id", row.id);
      if (uErr) {
        toast.error(uErr.message);
        return;
      }
      toast.success("Marcado como pendente.");
      void reload();
    },
    [reload],
  );

  const confirmMarkPaid = useCallback(async () => {
    const row = payDialogRow;
    if (!row || row.payment_status === "cancelled") return;
    setSaving(true);
    try {
      const { error: uErr } = await supabase
        .from("financial_transactions")
        .update({
          payment_status: "paid",
          paid_at: new Date().toISOString(),
          payment_method: payMethod || null,
        })
        .eq("id", row.id);
      if (uErr) {
        toast.error(uErr.message);
        return;
      }
      toast.success("Marcado como pago.");
      setPayDialogRow(null);
      setPayMethod("");
      void reload();
    } finally {
      setSaving(false);
    }
  }, [payDialogRow, payMethod, reload]);

  const removeManual = async (row: FinancialTransaction) => {
    if (row.origin !== "manual") return;
    const { error: dErr } = await supabase.from("financial_transactions").delete().eq("id", row.id);
    if (dErr) {
      toast.error(dErr.message);
      return;
    }
    toast.success("Lançamento removido.");
    void reload();
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lançamentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Receitas e despesas. Reservas entram automaticamente.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => void reload()} disabled={loading} aria-label="Atualizar">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button type="button" className="bg-primary text-primary-foreground" onClick={() => openCreateManual()}>
            <Plus className="mr-2 h-4 w-4" /> Novo manual
          </Button>
          <Button type="button" variant="outline" onClick={() => setActivePage("financeiro")}>
            Dashboard
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Linha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Meio</TableHead>
              <TableHead>Baixa</TableHead>
              <TableHead className="w-[200px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground">
                  A carregar…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground">
                  Sem lançamentos neste intervalo.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(r.occurred_on + "T12:00:00").toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    {r.origin === "repasse_reserva_transfer" || r.origin === "repasse_reserva_grupo" ? (
                      <Badge variant="outline" className="border-amber-500/50 text-xs text-amber-600 dark:text-amber-400">
                        Repasse
                      </Badge>
                    ) : r.origin === "manual" ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : r.is_primary ? (
                      <Badge variant="secondary" className="text-xs">
                        Principal
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-primary/40 text-xs text-primary">
                        Extra
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.kind === "receita" ? "default" : "secondary"}>{FINANCEIRO_KIND_LABEL[r.kind] ?? r.kind}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{FINANCEIRO_ORIGIN_LABEL[r.origin] ?? r.origin}</TableCell>
                  <TableCell className="text-sm">{r.category}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium">
                    {r.kind === "despesa" ? "− " : ""}
                    {formatBRL(Number(r.amount))}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{FINANCEIRO_STATUS_LABEL[r.payment_status] ?? r.payment_status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.payment_method && r.payment_method in FINANCEIRO_PAYMENT_METHOD_LABEL
                      ? FINANCEIRO_PAYMENT_METHOD_LABEL[r.payment_method as FinanceiroPaymentMethod]
                      : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {r.paid_at
                      ? new Date(r.paid_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.payment_status !== "cancelled" ? (
                        <>
                          {r.payment_status !== "paid" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => {
                                setPayMethod("");
                                setPayDialogRow(r);
                              }}
                            >
                              Pago
                            </Button>
                          ) : null}
                          {r.payment_status !== "pending" ? (
                            <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => void setPending(r)}>
                              Pendente
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                      {r.payment_status !== "cancelled" && r.origin === "manual" ? (
                        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => openEditManual(r)}>
                          <Pencil className="mr-1 h-3 w-3" />
                          Editar
                        </Button>
                      ) : null}
                      {r.payment_status !== "cancelled" && r.origin !== "manual" ? (
                        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => openEditLinked(r)}>
                          <Pencil className="mr-1 h-3 w-3" />
                          Editar
                        </Button>
                      ) : null}
                      {r.origin === "manual" ? (
                        <Button type="button" variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => void removeManual(r)}>
                          Excluir
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {hasMore ? (
        <Button type="button" variant="outline" className="self-center" disabled={loading} onClick={() => void loadMore()}>
          {loading ? "A carregar…" : "Carregar mais"}
        </Button>
      ) : null}
      </div>

      <Dialog
        open={payDialogRow !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPayDialogRow(null);
            setPayMethod("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar como pago</DialogTitle>
          </DialogHeader>
          {payDialogRow ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                {formatBRL(Number(payDialogRow.amount))} · {payDialogRow.description ?? payDialogRow.category}
              </p>
              <div>
                <Label>Meio de pagamento</Label>
                <Select value={payMethod || "__none__"} onValueChange={(v) => setPayMethod(v === "__none__" ? "" : (v as FinanceiroPaymentMethod))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Não indicar</SelectItem>
                    {FINANCEIRO_PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {FINANCEIRO_PAYMENT_METHOD_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPayDialogRow(null);
                setPayMethod("");
              }}
            >
              Cancelar
            </Button>
            <Button type="button" className="bg-primary text-primary-foreground" disabled={saving} onClick={() => void confirmMarkPaid()}>
              {saving ? "A guardar…" : "Confirmar baixa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) {
            setEditManualRow(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editManualRow ? "Editar lançamento manual" : "Novo lançamento manual"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Tipo</Label>
              <Select
                value={kind}
                onValueChange={(v) => {
                  const nk = v as "receita" | "despesa";
                  setKind(nk);
                  const presets = nk === "despesa" ? DESPESA_CATEGORY_PRESETS : RECEITA_MANUAL_PRESETS;
                  if (!presets.some((p) => p.value === category)) {
                    setCategory(presets[0].value);
                  }
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {category && !categoryPresetValues.has(category) ? (
                    <SelectItem value={category}>{category}</SelectItem>
                  ) : null}
                  {categoryPresets.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input className="mt-1" inputMode="decimal" placeholder="0,00" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
            </div>
            <div>
              <Label>Data</Label>
              <Input className="mt-1" type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea className="mt-1" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" className="bg-primary text-primary-foreground" disabled={saving} onClick={() => void handleSaveManual()}>
              {saving ? "A guardar…" : editManualRow ? "Atualizar" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editLinkedRow !== null}
        onOpenChange={(o) => {
          if (!o) setEditLinkedRow(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar lançamento</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Origem automática: pode alterar data de competência, descrição e categoria. O valor continua ligado à reserva (altere na reserva ou crie um lançamento manual à parte).
            </p>
          </DialogHeader>
          {editLinkedRow ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Valor (somente leitura): </span>
                <span className="font-mono font-semibold">
                  {editLinkedRow.kind === "despesa" ? "− " : ""}
                  {formatBRL(Number(editLinkedRow.amount))}
                </span>
                <span className="ml-2 text-muted-foreground">
                  · {FINANCEIRO_ORIGIN_LABEL[editLinkedRow.origin] ?? editLinkedRow.origin}
                </span>
              </div>
              <div>
                <Label>Data (competência)</Label>
                <Input className="mt-1" type="date" value={linkedOccurredOn} onChange={(e) => setLinkedOccurredOn(e.target.value)} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input className="mt-1" value={linkedCategory} onChange={(e) => setLinkedCategory(e.target.value)} placeholder="Texto livre" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea className="mt-1" rows={3} value={linkedDesc} onChange={(e) => setLinkedDesc(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditLinkedRow(null)}>
              Cancelar
            </Button>
            <Button type="button" className="bg-primary text-primary-foreground" disabled={saving} onClick={() => void handleSaveLinked()}>
              {saving ? "A guardar…" : "Atualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
