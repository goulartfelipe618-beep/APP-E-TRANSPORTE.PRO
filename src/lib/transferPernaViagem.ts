/** Reserva transfer persistida como duas linhas `somente_ida` + `perna_viagem` (ida | volta). */
export function isTransferPernaDividida(
  tipoViagem: string | null | undefined,
  pernaViagem: string | null | undefined,
): boolean {
  const tv = (tipoViagem ?? "").trim().toLowerCase();
  const perna = (pernaViagem ?? "").trim().toLowerCase();
  return tv === "somente_ida" && (perna === "ida" || perna === "volta");
}

export function transferPernaNormalizada(pernaViagem: string | null | undefined): "ida" | "volta" | null {
  const perna = (pernaViagem ?? "").trim().toLowerCase();
  if (perna === "ida" || perna === "volta") return perna;
  return null;
}

const TIPO_VIAGEM_LABEL: Record<string, string> = {
  somente_ida: "Somente Ida",
  ida_volta: "Ida e Volta",
  por_hora: "Por Hora",
};

/** Rótulo de tipo para tabelas, detalhes e Comunicar (não altera payload agregado). */
export function formatTransferTipoViagemExibicao(
  tipoViagem: string | null | undefined,
  pernaViagem?: string | null,
): string {
  const perna = transferPernaNormalizada(pernaViagem);
  if (isTransferPernaDividida(tipoViagem, pernaViagem) && perna) {
    return perna === "volta" ? "Ida e Volta · Volta" : "Ida e Volta · Ida";
  }
  const tv = (tipoViagem ?? "").trim().toLowerCase();
  return TIPO_VIAGEM_LABEL[tv] ?? (tipoViagem?.trim() || "—");
}

/** Título da secção de trajeto numa linha dividida (dados na coluna `ida_*`). */
export function transferSecaoTrajetoTitulo(
  tipoViagem: string | null | undefined,
  pernaViagem: string | null | undefined,
): string {
  const perna = transferPernaNormalizada(pernaViagem);
  if (isTransferPernaDividida(tipoViagem, pernaViagem) && perna === "volta") return "⇆ Volta";
  return "→ Ida";
}

export function transferMostraTrechoIdaCampos(
  tipoViagem: string | null | undefined,
  pernaViagem?: string | null,
): boolean {
  const tv = (tipoViagem ?? "").trim().toLowerCase();
  if (tv === "por_hora") return false;
  if (tv === "ida_volta" || tv === "somente_ida") return true;
  return isTransferPernaDividida(tipoViagem, pernaViagem);
}

export function transferMostraTrechoVoltaCampos(tipoViagem: string | null | undefined): boolean {
  return (tipoViagem ?? "").trim().toLowerCase() === "ida_volta";
}
