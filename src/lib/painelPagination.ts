/** Tamanho fixo de listagens tabulares / cartões no painel motorista. */
export const PAINEL_PAGE_SIZE = 10 as const;

export function painelTotalPages(totalItems: number): number {
  return Math.max(1, Math.ceil(Math.max(0, totalItems) / PAINEL_PAGE_SIZE));
}

export function painelSlicePage<T>(items: readonly T[], page1Based: number): { slice: T[]; page: number; totalPages: number } {
  const totalPages = painelTotalPages(items.length);
  const page = Math.min(Math.max(1, page1Based), totalPages);
  const start = (page - 1) * PAINEL_PAGE_SIZE;
  return { slice: items.slice(start, start + PAINEL_PAGE_SIZE), page, totalPages };
}
