import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActivePage } from "@/contexts/ActivePageContext";
import { useFinancialTransactions } from "@/hooks/useFinancialTransactions";
import { formatBRL, monthRangeUtc } from "@/lib/financeiroFrota";
import { cn } from "@/lib/utils";

export default function FinanceiroRelatoriosPage() {
  const { setActivePage } = useActivePage();
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const { start, end } = monthRangeUtc(cursor.y, cursor.m);
  const { rows, loading, error } = useFinancialTransactions(start, end, { limit: 2000, offset: 0 });

  const resumo = useMemo(() => {
    let receitaTotal = 0;
    let receitaPaga = 0;
    let despesaTotal = 0;
    let despesaPaga = 0;
    for (const r of rows) {
      if (r.kind === "receita" && r.payment_status !== "cancelled") {
        receitaTotal += Number(r.amount);
        if (r.payment_status === "paid") receitaPaga += Number(r.amount);
      }
      if (r.kind === "despesa" && r.payment_status !== "cancelled") {
        despesaTotal += Number(r.amount);
        if (r.payment_status === "paid") despesaPaga += Number(r.amount);
      }
    }
    const lucroLiquido = receitaPaga - despesaPaga;
    const topReceitas = [...rows]
      .filter((r) => r.kind === "receita" && r.payment_status !== "cancelled")
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5);
    return { receitaTotal, receitaPaga, despesaTotal, despesaPaga, lucroLiquido, topReceitas };
  }, [rows]);

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="mt-1 text-sm text-muted-foreground">Resumo por período (mês) e maiores receitas no mês.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setActivePage("financeiro")}>
          Dashboard
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" onClick={() => setCursor((c) => (c.m < 1 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={() => setCursor((c) => (c.m > 10 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="capitalize text-sm font-semibold text-foreground">{monthLabel}</span>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receita total (mês)</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold">{loading ? "…" : formatBRL(resumo.receitaTotal)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas total (mês)</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold">{loading ? "…" : formatBRL(resumo.despesaTotal)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lucro líquido (pago − pago)</CardTitle>
          </CardHeader>
          <CardContent className={cn("text-xl font-bold", resumo.lucroLiquido >= 0 ? "text-emerald-500" : "text-destructive")}>
            {loading ? "…" : formatBRL(resumo.lucroLiquido)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receitas mais rentáveis (top 5 no mês)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {loading ? (
            <p className="text-muted-foreground">A carregar…</p>
          ) : resumo.topReceitas.length === 0 ? (
            <p className="text-muted-foreground">Sem dados no mês.</p>
          ) : (
            <ol className="list-decimal space-y-2 pl-5">
              {resumo.topReceitas.map((r) => (
                <li key={r.id} className="text-foreground">
                  <span className="font-medium">{formatBRL(Number(r.amount))}</span>
                  <span className="text-muted-foreground"> — {r.description ?? r.origin}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Linhas de reserva canceladas entram como “Cancelado” e não entram nas somas acima.</p>
    </div>
  );
}
