import { motoristaMatchesAssignment } from "@/lib/motoristaReservaAssign";

/** Ficha do motorista neste login. Nunca inclui cadastro de outro portal. */
export type FichaPortalMotorista = {
  id: string;
  userId: string;
  portalAuthUserId: string;
};

export type ReservaPortalChecagem = {
  id?: string | null;
  motorista_id: string | null;
  owner_user_id?: string | null;
  acesso?: string | null;
};

/**
 * A reserva fica visível só se pertence ao administrador desta ficha
 * e ao próprio motorista (principal ou extra já marcado pelo servidor).
 */
export function reservaVisivelNoPortal(
  reserva: ReservaPortalChecagem,
  fichas: readonly FichaPortalMotorista[],
): boolean {
  if (fichas.length === 0) return false;
  const owner = (reserva.owner_user_id ?? "").trim();
  const daMesmaConta = fichas.filter((ficha) => !owner || ficha.userId === owner);
  if (daMesmaConta.length === 0) return false;

  if (reserva.acesso === "extra") return true;

  const atribuicao = (reserva.motorista_id ?? "").trim();
  if (!atribuicao) return false;
  return daMesmaConta.some((ficha) =>
    motoristaMatchesAssignment(atribuicao, {
      id: ficha.id,
      portal_auth_user_id: ficha.portalAuthUserId,
    }),
  );
}

/**
 * O motorista principal continua na regra antiga.
 * O 2º, 3º e 4º motorista entram quando a reserva está na lista de vínculos desta ficha,
 * mesmo que a lista principal só traga o motorista_id do primeiro.
 */
export function reservaEntraNaAgendaDoPortal(
  reserva: ReservaPortalChecagem,
  fichas: readonly FichaPortalMotorista[],
  reservasExtrasDesteMotorista?: ReadonlySet<string>,
): boolean {
  const id = (reserva.id ?? "").trim();
  if (id && reservasExtrasDesteMotorista?.has(id)) {
    if (fichas.length === 0) return false;
    const owner = (reserva.owner_user_id ?? "").trim();
    if (!owner) return true;
    return fichas.some((ficha) => ficha.userId === owner);
  }
  return reservaVisivelNoPortal(reserva, fichas);
}

export function unirReservasPorId<T extends { id: string }>(principal: readonly T[], complemento: readonly T[]): T[] {
  const porId = new Map<string, T>();
  for (const row of principal) porId.set(row.id, row);
  for (const row of complemento) {
    if (!porId.has(row.id)) porId.set(row.id, row);
  }
  return [...porId.values()];
}
