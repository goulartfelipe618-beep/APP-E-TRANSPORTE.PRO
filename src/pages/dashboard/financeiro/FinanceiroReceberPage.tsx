import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActivePage } from "@/contexts/ActivePageContext";
import { useFinancialTransactions } from "@/hooks/useFinancialTransactions";
import {
  FINANCEIRO_PAYMENT_METHOD_LABEL,
  FINANCEIRO_STATUS_LABEL,
  financeiroListagemRangePadrao,
  formatBRL,
  type FinanceiroPaymentMethod,
} from "@/lib/financeiroFrota";
import { usePainelListPagination } from "@/hooks/usePainelListPagination";
import { PainelPaginationBar } from "@/components/painel/PainelPaginationBar";

export default function FinanceiroReceberPage() {
  const { setActivePage } = useActivePage();
  const { from, to } = useMemo(() => financeiroListagemRangePadrao(), []);
  const { rows, loading, error } = useFinancialTransactions(from, to, { limit: 1500, offset: 0 });

  const receitasReserva = useMemo(
    () => rows.filter((r) => r.kind === "receita" && (r.origin === "reserva_transfer" || r.origin === "reserva_grupo")),
    [rows],
  );

  const { slice: receitasPage, page, setPage, totalPages, totalItems } = usePainelListPagination(receitasReserva);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas a receber</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Receitas geradas pelas reservas (transfer e grupos), incluindo viagens com data futura em contas a receber.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setActivePage("financeiro/lancamentos")}>
          Todos os lançamentos
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Linha</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Meio</TableHead>
              <TableHead>Baixa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  A carregar…
                </TableCell>
              </TableRow>
            ) : receitasReserva.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  Sem receitas de reserva no intervalo configurado.
                </TableCell>
              </TableRow>
            ) : (
              receitasPage.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(r.occurred_on + "T12:00:00").toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    {r.is_primary ? (
                      <Badge variant="secondary" className="text-xs">
                        Principal
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-primary/40 text-xs text-primary">
                        Extra
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{r.origin === "reserva_transfer" ? "Transfer" : "Grupo"}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">{r.description ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium">{formatBRL(Number(r.amount))}</TableCell>
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!loading && receitasReserva.length > 0 ? (
          <div className="border-t border-border px-4 py-4">
            <PainelPaginationBar page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">Para marcar como pago, use a página Lançamentos (ações por linha).</p>
    </div>
  );
}
