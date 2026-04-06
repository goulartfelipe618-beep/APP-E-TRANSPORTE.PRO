/** PostgREST quando a coluna ainda não existe na tabela / cache de schema. */
export function isMissingFonteColumnError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: string; message?: string };
  return e.code === "PGRST204" && (e.message ?? "").includes("fonte");
}
