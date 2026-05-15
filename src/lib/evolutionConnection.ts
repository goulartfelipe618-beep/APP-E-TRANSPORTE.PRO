/** Linha comunicadores_evolution (escopo usuário ou sistema): só usa campos de ligação. */
export type EvolutionConnectionRowLike = {
  telefone_conectado?: string | null;
  connection_status?: string | null;
};

const CONNECTED_STATUS = new Set(["open", "conectado", "connected", "online"]);

/** WhatsApp próprio Evolution conectado (instância do utilizador ligada ao telefone). */
export function isOwnEvolutionConnected(row: EvolutionConnectionRowLike | null): boolean {
  if (!row) return false;
  if (row.telefone_conectado?.trim()) return true;
  const s = (row.connection_status || "").trim().toLowerCase();
  return CONNECTED_STATUS.has(s);
}
