import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FINANCIAL_TRANSACTION_COLUMNS, type FinancialTransaction } from "@/lib/financeiroFrota";

/** Compat: número = só `limit`; objeto = `limit` + `offset` (paginação no servidor). */
export type UseFinancialTransactionsArg = number | { limit?: number; offset?: number } | undefined;

function normalizeFinancialQuery(arg: UseFinancialTransactionsArg): { limit: number; offset: number } {
  if (typeof arg === "number") return { limit: arg, offset: 0 };
  return { limit: arg?.limit ?? 50, offset: arg?.offset ?? 0 };
}

/**
 * Lançamentos financeiros do utilizador autenticado (RLS no Supabase).
 * Usa colunas explícitas e janela `occurred_on` + limite/offset para performance.
 */
export function useFinancialTransactions(
  from: string | undefined,
  to: string | undefined,
  arg?: UseFinancialTransactionsArg,
) {
  const { limit, offset } = normalizeFinancialQuery(arg);
  const [rows, setRows] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from("financial_transactions")
        .select(FINANCIAL_TRANSACTION_COLUMNS)
        .order("occurred_on", { ascending: false })
        .range(offset, offset + limit - 1);
      if (from) q = q.gte("occurred_on", from);
      if (to) q = q.lte("occurred_on", to);
      const { data, error: qErr } = await q;
      if (qErr) {
        setError(qErr.message);
        setRows([]);
        setHasMore(false);
        return;
      }
      const list = (data as FinancialTransaction[]) ?? [];
      setRows(list);
      setHasMore(list.length === limit);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
      setRows([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [from, to, limit, offset]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rows, loading, error, reload, hasMore };
}

/**
 * Lista financeira com paginação por página (ex.: Lançamentos), `pageSize` linhas por pedido ao servidor.
 */
export function useFinancialTransactionsPaginated(
  from: string | undefined,
  to: string | undefined,
  pageSize = 10,
) {
  const [page, setPage] = useState(0);
  const [tick, setTick] = useState(0);
  const [rows, setRows] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);

  const runFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const offset = page * pageSize;
    try {
      let q = supabase
        .from("financial_transactions")
        .select(FINANCIAL_TRANSACTION_COLUMNS)
        .order("occurred_on", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (from) q = q.gte("occurred_on", from);
      if (to) q = q.lte("occurred_on", to);
      const { data, error: qErr } = await q;
      if (qErr) {
        setError(qErr.message);
        setRows([]);
        setHasNextPage(false);
        return;
      }
      const chunk = (data as FinancialTransaction[]) ?? [];
      setRows(chunk);
      setHasNextPage(chunk.length === pageSize);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
      setRows([]);
      setHasNextPage(false);
    } finally {
      setLoading(false);
    }
  }, [from, to, page, pageSize, tick]);

  useEffect(() => {
    void runFetch();
  }, [runFetch]);

  /** Ao mudar o intervalo de datas, volta à primeira página antes do fetch. */
  useLayoutEffect(() => {
    setPage(0);
  }, [from, to]);

  const goNextPage = useCallback(() => {
    if (!hasNextPage || loading) return;
    setPage((p) => p + 1);
  }, [hasNextPage, loading]);

  const goPrevPage = useCallback(() => {
    if (page <= 0 || loading) return;
    setPage((p) => p - 1);
  }, [page, loading]);

  const reload = useCallback(() => {
    setPage(0);
    setTick((t) => t + 1);
  }, []);

  const hasPrevPage = page > 0;
  const pageDisplay = page + 1;

  return {
    rows,
    loading,
    error,
    reload,
    hasNextPage,
    hasPrevPage,
    goNextPage,
    goPrevPage,
    pageDisplay,
  };
}
