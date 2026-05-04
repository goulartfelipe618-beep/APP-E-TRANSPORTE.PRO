import { useEffect, useMemo, useState } from "react";
import { Wallet, List, Inbox, Banknote, FileBarChart, ChevronLeft, ChevronRight, User, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useActivePage } from "@/contexts/ActivePageContext";
import { useFinancialTransactions } from "@/hooks/useFinancialTransactions";
import { type FinancialTransaction, formatBRL, monthRangeUtc } from "@/lib/financeiroFrota";
import { FINANCEIRO_HIGHLIGHT_CLIENTE_ID_KEY } from "@/lib/sessionKeys";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

function sumRowsForSums(list: FinancialTransaction[]) {
  let faturado = 0;
  let recebido = 0;
  let pendenteReceita = 0;
  let despesas = 0;
  let despesasPagas = 0;
  let despesasPendentes = 0;
  for (const r of list) {
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
}

export default function FinanceiroDashboardPage() {
  const { setActivePage } = useActivePage();
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  /** Quando preenchido (ex.: vindo do menu Clientes), o dashboard filtra lançamentos ligados às reservas deste cliente. */
  const [filtroCliente, setFiltroCliente] = useState<{ id: string; nome: string } | null>(null);
  const [reservaTransferIds, setReservaTransferIds] = useState<string[]>([]);
  const [reservaGrupoIds, setReservaGrupoIds] = useState<string[]>([]);
  const [idsReservasLoading, setIdsReservasLoading] = useState(false);
  const [valorReservasTabelaMes, setValorReservasTabelaMes] = useState<number | null>(null);
  const [reservasTabelaMesLoading, setReservasTabelaMesLoading] = useState(false);

  const { start, end } = monthRangeUtc(cursor.y, cursor.m);
  const { rows, loading, error } = useFinancialTransactions(start, end, { limit: 2000, offset: 0 });

  const transferIdSet = useMemo(() => new Set(reservaTransferIds), [reservaTransferIds]);
  const grupoIdSet = useMemo(() => new Set(reservaGrupoIds), [reservaGrupoIds]);

  const rowsVisiveis = useMemo(() => {
    if (!filtroCliente) return rows;
    if (transferIdSet.size === 0 && grupoIdSet.size === 0) return [];
    return rows.filter(
      (r) =>
        (r.reserva_transfer_id != null && transferIdSet.has(r.reserva_transfer_id)) ||
        (r.reserva_grupo_id != null && grupoIdSet.has(r.reserva_grupo_id)),
    );
  }, [rows, filtroCliente, transferIdSet, grupoIdSet]);

  const sums = useMemo(() => sumRowsForSums(rowsVisiveis), [rowsVisiveis]);

  const viagensComMovimentoNoMes = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rowsVisiveis) {
      if (r.reserva_transfer_id) ids.add(`t:${r.reserva_transfer_id}`);
      if (r.reserva_grupo_id) ids.add(`g:${r.reserva_grupo_id}`);
    }
    return ids.size;
  }, [rowsVisiveis]);

  useEffect(() => {
    const raw = sessionStorage.getItem(FINANCEIRO_HIGHLIGHT_CLIENTE_ID_KEY);
    if (!raw) return;
    sessionStorage.removeItem(FINANCEIRO_HIGHLIGHT_CLIENTE_ID_KEY);
    void (async () => {
      const { data } = await supabase.from("cadastro_clientes").select("nome_exibicao").eq("id", raw).maybeSingle();
      setFiltroCliente({ id: raw, nome: data?.nome_exibicao ? String(data.nome_exibicao) : "Cliente" });
    })();
  }, []);

  useEffect(() => {
    if (!filtroCliente?.id) {
      setReservaTransferIds([]);
      setReservaGrupoIds([]);
      return;
    }
    let cancelled = false;
    setIdsReservasLoading(true);
    void (async () => {
      const [t, g] = await Promise.all([
        supabase.from("reservas_transfer").select("id").eq("cadastro_cliente_id", filtroCliente.id),
        supabase.from("reservas_grupos").select("id").eq("cadastro_cliente_id", filtroCliente.id),
      ]);
      if (cancelled) return;
      setReservaTransferIds((t.data ?? []).map((r: { id: string }) => r.id));
      setReservaGrupoIds((g.data ?? []).map((r: { id: string }) => r.id));
      setIdsReservasLoading(false);
    })();
    return () => {
      cancelled = true;
      setIdsReservasLoading(false);
    };
  }, [filtroCliente?.id]);

  /** Soma `valor_total` das reservas com data principal no mês (referência das tabelas de reserva, não substitui o financeiro). */
  useEffect(() => {
    if (!filtroCliente?.id) {
      setValorReservasTabelaMes(null);
      return;
    }
    let cancelled = false;
    setReservasTabelaMesLoading(true);
    void (async () => {
      const [t, g] = await Promise.all([
        supabase
          .from("reservas_transfer")
          .select("valor_total")
          .eq("cadastro_cliente_id", filtroCliente.id)
          .gte("ida_data", start)
          .lte("ida_data", end),
        supabase
          .from("reservas_grupos")
          .select("valor_total")
          .eq("cadastro_cliente_id", filtroCliente.id)
          .gte("data_ida", start)
          .lte("data_ida", end),
      ]);
      if (cancelled) return;
      const sum = (rowsIn: { valor_total?: unknown }[] | null) =>
        (rowsIn ?? []).reduce((a, r) => a + (Number(r.valor_total) || 0), 0);
      setValorReservasTabelaMes(
        sum(t.data as { valor_total?: unknown }[]) + sum(g.data as { valor_total?: unknown }[]),
      );
      setReservasTabelaMesLoading(false);
    })();
    return () => {
      cancelled = true;
      setReservasTabelaMesLoading(false);
    };
  }, [filtroCliente?.id, start, end]);

  const limparFiltroCliente = () => {
    setFiltroCliente(null);
    setReservaTransferIds([]);
    setReservaGrupoIds([]);
    setValorReservasTabelaMes(null);
  };

  const numerosLoading = loading || (Boolean(filtroCliente) && idsReservasLoading);

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
          Receitas ligadas às reservas, despesas manuais e estado de pagamento. Cada conta vê apenas os seus dados (RLS). Ao concluir uma reserva com repasse ao motorista, gera-se uma despesa automática — o lucro projetado já reflete receita menos repasses e outras despesas do mês.
        </p>
      </div>

      {filtroCliente ? (
        <Alert className="border-primary/40 bg-primary/5">
          <User className="h-4 w-4 text-primary" />
          <AlertTitle className="text-foreground">Filtro por cliente</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="space-y-1 text-sm">
              <p>
                A mostrar apenas lançamentos do mês ligados a reservas de{" "}
                <strong className="text-foreground">{filtroCliente.nome}</strong> (transfer ou grupo com cliente
                atribuído).
              </p>
              <p className="text-xs text-muted-foreground">
                {idsReservasLoading
                  ? "A carregar reservas…"
                  : `${reservaTransferIds.length + reservaGrupoIds.length} reserva(s) com vínculo · ${rowsVisiveis.length} lançamento(s) no mês · ${viagensComMovimentoNoMes} reserva(s) com movimento financeiro neste mês.`}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={limparFiltroCliente}>
                <FilterX className="h-4 w-4" />
                Limpar filtro
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={prevMonth} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={nextMonth} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="min-w-[10rem] capitalize text-sm font-semibold text-foreground">{monthLabel}</span>
          {filtroCliente ? (
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              Filtro: {filtroCliente.nome}
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">
          {error} — confirme se as migrações{" "}
          <code className="rounded bg-muted px-1">20260522130000_financial_transactions_frota</code> e{" "}
          <code className="rounded bg-muted px-1">20260523120000_financial_transactions_evolution</code> e{" "}
          <code className="rounded bg-muted px-1">20260524130000_multitenant_perf_financial_integrity</code> e{" "}
          <code className="rounded bg-muted px-1">20260526120000_reserva_repasse_status_financeiro</code> foram aplicadas no Supabase.
        </p>
      ) : null}

      {filtroCliente ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Valor total nas reservas (mês)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Soma de <code className="rounded bg-muted px-1">valor_total</code> das reservas transfer (ida neste mês) e
              grupo (data_ida neste mês) com este cliente. O quadro acima usa os lançamentos financeiros filtrados.
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {reservasTabelaMesLoading ? "…" : formatBRL(valorReservasTabelaMes ?? 0)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Wallet className="h-4 w-4 text-primary" /> Faturado (receitas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{numerosLoading ? "…" : formatBRL(sums.faturado)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Soma de receitas não canceladas no mês{filtroCliente ? " (filtrado)." : "."}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recebido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-500">{numerosLoading ? "…" : formatBRL(sums.recebido)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Receitas marcadas como pagas.</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendente (receber)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-500">{numerosLoading ? "…" : formatBRL(sums.pendenteReceita)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Ainda não marcado como pago.</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lucro real (caixa)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-2xl font-bold", sums.lucroReal >= 0 ? "text-foreground" : "text-destructive")}>
              {numerosLoading ? "…" : formatBRL(sums.lucroReal)}
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
              {numerosLoading ? "…" : formatBRL(sums.lucroProjetado)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Faturado − todas as despesas do mês (não canceladas).</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Despesas no mês{filtroCliente ? " (filtrado)" : ""}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-muted-foreground">Total (não canceladas)</p>
            <p className="text-lg font-semibold text-foreground">{numerosLoading ? "…" : formatBRL(sums.despesas)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Pagas</p>
            <p className="text-lg font-semibold text-foreground">{numerosLoading ? "…" : formatBRL(sums.despesasPagas)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Pendentes (a pagar)</p>
            <p className="text-lg font-semibold text-amber-500">{numerosLoading ? "…" : formatBRL(sums.despesasPendentes)}</p>
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
        Reservas novas ou atualizadas geram ou ajustam lançamentos automaticamente. O estado financeiro (pago/pendente) é independente do estado da viagem. Repasses de motorista entram como despesas quando a reserva passa a concluída com valor de repasse.
      </p>
    </div>
  );
}
