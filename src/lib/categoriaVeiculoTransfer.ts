/** Categorias de veículo obrigatórias em reservas de transfer. */
export const CATEGORIAS_VEICULO_TRANSFER = [
  { value: "van", label: "VAN", abrev: "VAN" },
  { value: "micro_onibus", label: "MICRO-ÔNIBUS", abrev: "MIC." },
  { value: "veiculo_07_lugares", label: "VEÍCULOS 07 LUGARES", abrev: "07LUG." },
  { value: "mini_van", label: "MINI VAN", abrev: "MINIVAN" },
  { value: "sedan", label: "SEDAN", abrev: "SED" },
  { value: "hatch", label: "HATCH", abrev: "HAT" },
  { value: "onibus", label: "ÔNIBUS", abrev: "ONIBUS" },
] as const;

export type CategoriaVeiculoTransfer = (typeof CATEGORIAS_VEICULO_TRANSFER)[number]["value"];

const VALUE_SET = new Set<string>(CATEGORIAS_VEICULO_TRANSFER.map((c) => c.value));

export function isCategoriaVeiculoTransfer(v: string | null | undefined): v is CategoriaVeiculoTransfer {
  return typeof v === "string" && VALUE_SET.has(v);
}

export function labelCategoriaVeiculoTransfer(v: string | null | undefined): string {
  if (!v) return "—";
  const hit = CATEGORIAS_VEICULO_TRANSFER.find((c) => c.value === v);
  return hit?.label ?? v;
}

/** Sigla curta para o painel da agenda. */
export function abrevCategoriaVeiculoTransfer(v: string | null | undefined): string | null {
  if (!v) return null;
  const hit = CATEGORIAS_VEICULO_TRANSFER.find((c) => c.value === v);
  return hit?.abrev ?? null;
}
