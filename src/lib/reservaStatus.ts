/** Estados operacionais sugeridos (texto livre legado continua aceite na BD). */
export const RESERVA_STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
] as const;

export type ReservaStatusValue = (typeof RESERVA_STATUS_OPTIONS)[number]["value"];

export function labelReservaStatus(status: string | null | undefined): string {
  const s = (status ?? "").trim();
  const hit = RESERVA_STATUS_OPTIONS.find((o) => o.value === s);
  if (hit) return hit.label;
  return s || "—";
}

export function badgeToneReservaStatus(status: string | null | undefined): "default" | "secondary" | "destructive" | "outline" {
  const s = (status ?? "").toLowerCase();
  if (s.includes("cancel")) return "destructive";
  if (s === "concluida" || s === "concluída" || s.includes("conclu")) return "secondary";
  if (s === "em_andamento" || s.includes("andamento")) return "default";
  return "outline";
}
