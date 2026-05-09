import { useEffect, useMemo, useState } from "react";
import { painelSlicePage } from "@/lib/painelPagination";

/**
 * Paginação cliente (10 linhas/cartões). Repõe a página 1 quando a lista `items` muda (nova referência)
 * ou quando `extraResetKey` muda (ex.: alternar vista cartões/tabela).
 */
export function usePainelListPagination<T>(items: readonly T[], extraResetKey?: string | number) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items, extraResetKey]);

  const { slice, totalPages, page: effectivePage } = useMemo(
    () => painelSlicePage(items, page),
    [items, page],
  );

  useEffect(() => {
    if (page !== effectivePage) {
      setPage(effectivePage);
    }
  }, [page, effectivePage]);

  return {
    page: effectivePage,
    setPage,
    slice,
    totalPages,
    totalItems: items.length,
  };
}
