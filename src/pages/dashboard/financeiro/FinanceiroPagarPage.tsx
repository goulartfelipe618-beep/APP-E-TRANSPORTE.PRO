import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActivePage } from "@/contexts/ActivePageContext";
import { useFinancialTransactions } from "@/hooks/useFinancialTransactions";
import { FINANCEIRO_STATUS_LABEL, financeiroListagemRangePadrao, formatBRL } from "@/lib/financeiroFrota";
import { usePainelListPagination } from "@/hooks/usePainelListPagination";
import { PainelPaginationBar } from "@/components/painel/PainelPaginationBar";

export default function FinanceiroPagarPage() {
  const { setActivePage } = useActivePage();
  const { from, to } = useMemo(() => financeiroListagemRangePadrao(), []);
  const { rows, loading, error } = useFinancialTransactions(from, to, { limit: 1500, offset: 0 });

  const despesas = useMemo(() => rows.filter((r) => r.kind === "despesa"), [rows]);

  const { slice: despesasPage, page, setPage, totalPages, totalItems } = usePainelListPagination(despesas);

  return (
    <div className="min-w-0 space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas a pagar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Combustível, manutenção, taxas e outras despesas registadas manualmente.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setActivePage("financeiro/lancamentos")}>
          Lançamentos
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  A carregar…
                </TableCell>
              </TableRow>
            ) : despesas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Sem despesas. Crie em Lançamentos → Novo manual.
                </TableCell>
              </TableRow>
            ) : (
              despesasPage.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(r.occurred_on + "T12:00:00").toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-sm">{r.category}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">{r.description ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium text-destructive">− {formatBRL(Number(r.amount))}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{FINANCEIRO_STATUS_LABEL[r.payment_status] ?? r.payment_status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!loading && despesas.length > 0 ? (
          <div className="border-t border-border px-4 py-4">
            <PainelPaginationBar page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
