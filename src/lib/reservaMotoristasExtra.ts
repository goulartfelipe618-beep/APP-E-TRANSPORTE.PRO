import { supabase } from "@/integrations/supabase/client";
import { motoristaMatchesAssignment } from "@/lib/motoristaReservaAssign";

export type ReservaKind = "transfer" | "grupo";

export type MotoristaDaFrota = {
  id: string;
  portal_auth_user_id?: string | null;
  user_id?: string | null;
};

/**
 * Converte a seleção da tela no id do cadastro (ficha) de cada motorista extra.
 * Só entra motorista desta conta. O principal não é repetido. Outro administrador nunca entra.
 */
export function resolverMotoristasExtras(opts: {
  selecionados: string[];
  primaryId?: string | null;
  motoristas: MotoristaDaFrota[];
  userId: string;
}): { ids: string[]; recusados: string[] } {
  const dono = opts.userId.trim();
  const primary = (opts.primaryId ?? "").trim();
  const ids = new Set<string>();
  const recusados: string[] = [];

  for (const raw of opts.selecionados) {
    const valor = raw.trim();
    if (!valor) continue;
    const ficha = opts.motoristas.find((m) => {
      if ((m.user_id ?? "").trim() && (m.user_id ?? "").trim() !== dono) return false;
      return m.id === valor || motoristaMatchesAssignment(valor, m);
    });
    if (!ficha || !(ficha.id ?? "").trim()) {
      recusados.push(valor);
      continue;
    }
    const cardId = ficha.id.trim();
    const mesmoPrincipal =
      primary !== "" &&
      (cardId === primary || motoristaMatchesAssignment(primary, ficha));
    if (mesmoPrincipal) continue;
    ids.add(cardId);
  }

  return { ids: [...ids], recusados };
}

export async function listExtrasDoOperador(
  kind: ReservaKind,
  userId: string,
): Promise<{ reserva_id: string; motorista_id: string }[]> {
  const { data, error } = await supabase
    .from("reserva_motoristas_extra")
    .select("reserva_id, motorista_id")
    .eq("reserva_kind", kind)
    .eq("user_id", userId);
  if (error || !data) return [];
  return data
    .map((row) => ({
      reserva_id: String(row.reserva_id ?? ""),
      motorista_id: String(row.motorista_id ?? "").trim(),
    }))
    .filter((row) => row.reserva_id && row.motorista_id);
}

export async function listReservaMotoristasExtra(kind: ReservaKind, reservaId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("reserva_motoristas_extra")
    .select("motorista_id")
    .eq("reserva_kind", kind)
    .eq("reserva_id", reservaId);
  if (error || !data) return [];
  return data.map((row) => String(row.motorista_id ?? "").trim()).filter(Boolean);
}

/** Grava só os motoristas desta reserva e desta conta. Não altera outras reservas nem o motorista principal. */
export async function replaceReservaMotoristasExtra(opts: {
  userId: string;
  kind: ReservaKind;
  reservaId: string;
  motoristaIds: string[];
  primaryId?: string | null;
}): Promise<string | null> {
  const frota = await supabase
    .from("solicitacoes_motoristas")
    .select("id, portal_auth_user_id, user_id")
    .eq("user_id", opts.userId)
    .eq("status", "cadastrado");
  if (frota.error) return frota.error.message;

  const { ids, recusados } = resolverMotoristasExtras({
    selecionados: opts.motoristaIds,
    primaryId: opts.primaryId,
    motoristas: (frota.data ?? []) as MotoristaDaFrota[],
    userId: opts.userId,
  });
  if (recusados.length > 0) {
    return "Um dos motoristas marcados não pertence à sua frota. A reserva não foi vinculada a ele.";
  }

  const removed = await supabase
    .from("reserva_motoristas_extra")
    .delete()
    .eq("reserva_kind", opts.kind)
    .eq("reserva_id", opts.reservaId)
    .eq("user_id", opts.userId);
  if (removed.error) return removed.error.message;
  if (ids.length === 0) return null;

  const inserted = await supabase
    .from("reserva_motoristas_extra")
    .insert(
      ids.map((motorista_id) => ({
        user_id: opts.userId,
        reserva_kind: opts.kind,
        reserva_id: opts.reservaId,
        motorista_id,
      })),
    )
    .select("id");
  if (inserted.error) return inserted.error.message;
  if ((inserted.data ?? []).length !== ids.length) {
    return "A reserva foi salva, mas o vínculo com os outros motoristas não foi confirmado.";
  }
  return null;
}
