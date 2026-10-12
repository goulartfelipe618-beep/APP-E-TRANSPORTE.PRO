import { motoristaMatchesAssignment } from "@/lib/motoristaReservaAssign";

/** Ficha do motorista neste login. Nunca inclui cadastro de outro portal. */
export type FichaPortalMotorista = {
  id: string;
  userId: string;
  portalAuthUserId: string;
};

export type ReservaPortalChecagem = {
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
