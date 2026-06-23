import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActivePage } from "@/contexts/ActivePageContext";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/financeiroFrota";
import { formatDbCalendarDatePtBr } from "@/lib/painelAgendaReservas";
import { labelReservaStatus } from "@/lib/reservaStatus";
import { usePainelListPagination } from "@/hooks/usePainelListPagination";
import { PainelPaginationBar } from "@/components/painel/PainelPaginationBar";
import { FileText, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type ReservaFaturada = Pick<
  Tables<"reservas_transfer">,
  | "id"
  | "numero_reserva"
  | "nome_completo"
  | "valor_total"
  | "metodo_pagamento"
  | "status"
  | "ida_data"
  | "por_hora_data"
  | "created_at"
  | "faturado"
>;

function dataViagemExibicao(r: ReservaFaturada): string {
  const raw = r.por_hora_data || r.ida_data;
  return formatDbCalendarDatePtBr(raw) || "—";
}

export default function FinanceiroFaturadoPage() {
  const { setActivePage } = useActivePage();
  const [rows, setRows] = useState<ReservaFaturada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setRows([]);
      setError("Sessão inválida.");
      setLoading(false);
      return;
    }
    const { data, error: qErr } = await supabase
      .from("reservas_transfer")
      .select("id,numero_reserva,nome_completo,valor_total,metodo_pagamento,status,ida_data,por_hora_data,created_at,faturado")
      .eq("user_id", auth.user.id)
      .eq("faturado", true)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (qErr) {
      setError(qErr.message);
      setRows([]);
    } else {
      setRows((data as ReservaFaturada[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPendente = useMemo(
    () => rows.reduce((acc, r) => acc + (Number(r.valor_total) || 0), 0),
    [rows],
  );

  const { slice: pageRows, page, setPage, totalPages, totalItems } = usePainelListPagination(rows);

  return (
    <div className="min-w-0 space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Faturado</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reservas de transfer marcadas como <strong className="text-foreground">faturadas</strong> — serviço prestado
            com cobrança em data posterior.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Atualizar">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button type="button" variant="outline" onClick={() => setActivePage("financeiro/receber")}>
            Contas a receber
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reservas faturadas</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{loading ? "…" : totalItems}</p>
        </div>
        <div className="rounded-xl border border-[#FF6600]/30 bg-[#FF6600]/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total a receber (faturado)</p>
          <p className="mt-2 text-2xl font-bold text-[#FF6600]">{loading ? "…" : formatBRL(totalPendente)}</p>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Data viagem</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Criada em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  A carregar…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  Nenhuma reserva marcada como faturada. Defina a opção ao criar ou editar uma reserva em Transfer →
                  Reservas.
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">#{r.numero_reserva}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm font-medium">{r.nome_completo}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{dataViagemExibicao(r)}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium">{formatBRL(Number(r.valor_total))}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.metodo_pagamento || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-[#FF6600]/50 text-[#FF6600]">
                      {labelReservaStatus(r.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 ? (
        <PainelPaginationBar page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
      ) : null}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5 shrink-0" />
        As receitas vinculadas continuam em Contas a receber; aqui listam-se apenas reservas com flag faturado activa.
      </p>
    </div>
  );
}
