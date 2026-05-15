/**
 * Divide um montante em duas metades em centavos (soma exacta ao original).
 */
export function splitAmountInTwoHalves(total: number): [number, number] {
  const cents = Math.round(Number(total) * 100);
  if (!Number.isFinite(cents) || cents <= 0) return [0, 0];
  const a = Math.floor(cents / 2);
  return [a / 100, (cents - a) / 100];
}

export function valorTotalFromBaseDiscount(base: number, descontoPct: number): number {
  const b = Number(base) || 0;
  const d = Number(descontoPct) || 0;
  return Math.round((b - (b * d) / 100) * 100) / 100;
}
