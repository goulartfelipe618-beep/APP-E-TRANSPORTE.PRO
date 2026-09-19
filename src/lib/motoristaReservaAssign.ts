/** Valor gravado em `reservas_*.motorista_id` para o mini portal reconhecer a reserva. */
export function motoristaAssignValue(m: { id: string; portal_auth_user_id?: string | null }): string {
  const portal = (m.portal_auth_user_id ?? "").trim();
  return portal || m.id;
}

export function motoristaMatchesAssignment(
  assignment: string | null | undefined,
  m: { id: string; portal_auth_user_id?: string | null },
): boolean {
  const a = (assignment ?? "").trim();
  if (!a) return false;
  return a === m.id || a === (m.portal_auth_user_id ?? "").trim();
}

export function resolveMotoristaNome(
  assignment: string | null | undefined,
  motoristas: { id: string; nome: string; portal_auth_user_id?: string | null }[],
): string {
  const a = (assignment ?? "").trim();
  if (!a) return "—";
  const hit = motoristas.find((m) => motoristaMatchesAssignment(a, m));
  return hit?.nome ?? "Motorista atribuído";
}
