import { useMemo, useState } from "react";
import { Wallet, List, Inbox, Banknote, FileBarChart, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActivePage } from "@/contexts/ActivePageContext";
import { useFinancialTransactions } from "@/hooks/useFinancialTransactions";
import { formatBRL, monthRangeUtc } from "@/lib/financeiroFrota";
import { cn } from "@/lib/utils";

export default function FinanceiroDashboardPage() {
  const { setActivePage } = useActivePage();
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const { start, end } = monthRangeUtc(cursor.y, cursor.m);
  const { rows, loading, error } = useFinancialTransactions(start, end, { limit: 2000, offset: 0 });

  const sums = useMemo(() => {
    let faturado = 0;
    let recebido = 0;
    let pendenteReceita = 0;
    let despesas = 0;
    let despesasPagas = 0;
    let despesasPendentes = 0;
    for (const r of rows) {
      if (r.kind === "receita" && r.payment_status !== "cancelled") {
        faturado += Number(r.amount);
        if (r.payment_status === "paid") recebido += Number(r.amount);
        if (r.payment_status === "pending") pendenteReceita += Number(r.amount);
      }
      if (r.kind === "despesa" && r.payment_status !== "cancelled") {
        despesas += Number(r.amount);
        if (r.payment_status === "paid") despesasPagas += Number(r.amount);
        if (r.payment_status === "pending") despesasPendentes += Number(r.amount);
      }
    }
    const lucroReal = recebido - despesasPagas;
    const lucroProjetado = faturado - despesas;
    return {
      faturado,
      recebido,
      pendenteReceita,
      despesas,
      despesasPagas,
      despesasPendentes,
      lucroReal,
      lucroProjetado,
    };
  }, [rows]);

  const prevMonth = () => {
    setCursor((c) => {
      const nm = c.m - 1;
      if (nm < 0) return { y: c.y - 1, m: 11 };
      return { y: c.y, m: nm };
    });
  };

  const nextMonth = () => {
    setCursor((c) => {
      const nm = c.m + 1;
      if (nm > 11) return { y: c.y + 1, m: 0 };
      return { y: c.y, m: nm };
    });
  };

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Financeiro</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Receitas ligadas às reservas, despesas manuais e estado de pagamento. Cada conta vê apenas os seus dados (RLS).
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={prevMonth} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={nextMonth} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="min-w-[10rem] capitalize text-sm font-semibold text-foreground">{monthLabel}</span>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">
          {error} — confirme se as migrações{" "}
          <code className="rounded bg-muted px-1">20260522130000_financial_transactions_frota</code> e{" "}
          <code className="rounded bg-muted px-1">20260523120000_financial_transactions_evolution</code> e{" "}
          <code className="rounded bg-muted px-1">20260524130000_multitenant_perf_financial_integrity</code> foram aplicadas no Supabase.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Wallet className="h-4 w-4 text-primary" /> Faturado (receitas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{loading ? "…" : formatBRL(sums.faturado)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Soma de receitas não canceladas no mês.</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recebido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-500">{loading ? "…" : formatBRL(sums.recebido)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Receitas marcadas como pagas.</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendente (receber)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-500">{loading ? "…" : formatBRL(sums.pendenteReceita)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Ainda não marcado como pago.</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lucro real (caixa)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-2xl font-bold", sums.lucroReal >= 0 ? "text-foreground" : "text-destructive")}>
              {loading ? "…" : formatBRL(sums.lucroReal)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Recebido − despesas pagas no mês.</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lucro projetado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-2xl font-bold", sums.lucroProjetado >= 0 ? "text-foreground" : "text-destructive")}>
              {loading ? "…" : formatBRL(sums.lucroProjetado)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Faturado − todas as despesas do mês (não canceladas).</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Despesas no mês</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-muted-foreground">Total (não canceladas)</p>
            <p className="text-lg font-semibold text-foreground">{loading ? "…" : formatBRL(sums.despesas)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Pagas</p>
            <p className="text-lg font-semibold text-foreground">{loading ? "…" : formatBRL(sums.despesasPagas)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Pendentes (a pagar)</p>
            <p className="text-lg font-semibold text-amber-500">{loading ? "…" : formatBRL(sums.despesasPendentes)}</p>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Áreas</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => setActivePage("financeiro/lancamentos")}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
          >
            <List className="h-5 w-5 shrink-0 text-primary" />
            <span className="font-medium text-foreground">Lançamentos</span>
          </button>
          <button
            type="button"
            onClick={() => setActivePage("financeiro/receber")}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
          >
            <Inbox className="h-5 w-5 shrink-0 text-primary" />
            <span className="font-medium text-foreground">Contas a receber</span>
          </button>
          <button
            type="button"
            onClick={() => setActivePage("financeiro/pagar")}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
          >
            <Banknote className="h-5 w-5 shrink-0 text-primary" />
            <span className="font-medium text-foreground">Contas a pagar</span>
          </button>
          <button
            type="button"
            onClick={() => setActivePage("financeiro/relatorios")}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
          >
            <FileBarChart className="h-5 w-5 shrink-0 text-primary" />
            <span className="font-medium text-foreground">Relatórios</span>
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Reservas novas ou atualizadas geram ou ajustam lançamentos automaticamente. O estado financeiro (pago/pendente) é independente do estado da viagem.
      </p>
    </div>
  );
}
