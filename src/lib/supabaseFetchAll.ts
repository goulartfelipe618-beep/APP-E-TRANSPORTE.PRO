/**
 * PostgREST/Supabase corta selects em ~1000 linhas por defeito.
 * Contas com muitas reservas (≈1000+) perdiam as mais recentes na agenda/listagens.
 */

export type SupabasePageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

const DEFAULT_PAGE_SIZE = 1000;
const HARD_CAP = 50_000;

/**
 * Percorre `.range()` até esgotar páginas. O `queryFactory` deve devolver
 * um builder já com `.select()` / filtros / `.order()`, sem `.range()` aplicado.
 */
export async function fetchAllSupabasePages<T>(
  queryFactory: (from: number, to: number) => PromiseLike<SupabasePageResult<T>>,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<{ data: T[]; error: string | null }> {
  const size = Math.max(1, Math.min(pageSize, DEFAULT_PAGE_SIZE));
  const out: T[] = [];
  let from = 0;

  while (from < HARD_CAP) {
    const to = from + size - 1;
    const { data, error } = await queryFactory(from, to);
    if (error) {
      return { data: out, error: error.message };
    }
    const chunk = data ?? [];
    out.push(...chunk);
    if (chunk.length < size) break;
    from += size;
  }

  return { data: out, error: null };
}
