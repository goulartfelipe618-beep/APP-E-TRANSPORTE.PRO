/** Estados operacionais sugeridos (texto livre legado continua aceite na BD). */
export const RESERVA_STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "confirmada", label: "Confirmada" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
] as const;

export type ReservaStatusValue = (typeof RESERVA_STATUS_OPTIONS)[number]["value"];

function foldReservaStatusToken(status: string | null | undefined): string {
  return (status ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
}

/** Aceita legado (confirmado, concluído, etc.) e devolve a chave gravada na BD. */
export function normalizeReservaStatus(status: string | null | undefined): string {
  const s = foldReservaStatusToken(status);
  if (!s) return "pendente";
  if (s === "confirmado" || s === "confirmada") return "confirmada";
  if (s === "concluido" || s === "concluida") return "concluida";
  if (s === "cancelado" || s === "cancelada") return "cancelada";
  if (s === "em_andamento" || s === "emandamento" || s === "andamento") return "em_andamento";
  if (s === "pendente") return "pendente";
  return s;
}

export function isCatalogReservaStatus(status: string | null | undefined): boolean {
  const s = normalizeReservaStatus(status);
  return RESERVA_STATUS_OPTIONS.some((o) => o.value === s);
}

export function labelReservaStatus(status: string | null | undefined): string {
  const s = normalizeReservaStatus(status);
  const hit = RESERVA_STATUS_OPTIONS.find((o) => o.value === s);
  if (hit) return hit.label;
  return (status ?? "").trim() || "—";
}

export function badgeToneReservaStatus(status: string | null | undefined): "default" | "secondary" | "destructive" | "outline" {
  const s = (status ?? "").toLowerCase();
  if (s.includes("cancel")) return "destructive";
  if (s === "concluida" || s === "concluída" || s.includes("conclu")) return "secondary";
  if (s === "confirmada" || s === "confirmado" || s.includes("confirm")) return "default";
  if (s === "em_andamento" || s.includes("andamento")) return "default";
  return "outline";
}
