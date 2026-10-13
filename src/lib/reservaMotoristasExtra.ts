import { supabase } from "@/integrations/supabase/client";
import { motoristaMatchesAssignment } from "@/lib/motoristaReservaAssign";
import { splitAmountInTwoHalves } from "@/lib/reservaIdaVoltaSplit";

export type ReservaKind = "transfer" | "grupo";

export type MotoristaDaFrota = {
  id: string;
  portal_auth_user_id?: string | null;
  user_id?: string | null;
};

export type VinculoExtraGravado = { motoristaId: string; repasse: number | null };

export type RepasseExtraInformado = { motoristaId: string; repasse: string };

/** Valor digitado no formulário. Vazio significa motorista vinculado sem repasse. */
export function parseRepasseInformado(raw: string): { ok: true; valor: number | null } | { ok: false } {
  const texto = raw.trim();
  if (!texto) return { ok: true, valor: null };
  const n = Number(texto.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return { ok: false };
  if (n === 0) return { ok: true, valor: null };
  return { ok: true, valor: Math.round(n * 100) / 100 };
}

export function montarVinculosExtrasParaGravar(
  linhas: RepasseExtraInformado[],
): { ok: true; vinculos: VinculoExtraGravado[] } | { ok: false } {
  const vinculos: VinculoExtraGravado[] = [];
  for (const linha of linhas) {
    const motoristaId = linha.motoristaId.trim();
    if (!motoristaId) continue;
    const parsed = parseRepasseInformado(linha.repasse);
    if (!parsed.ok) return { ok: false };
    vinculos.push({ motoristaId, repasse: parsed.valor });
  }
  return { ok: true, vinculos };
}

/** Ida e volta gravadas juntas dividem cada repasse. A soma das duas pernas é o valor informado. */
export function dividirVinculosNasDuasPernas(vinculos: VinculoExtraGravado[]): {
  ida: VinculoExtraGravado[];
  volta: VinculoExtraGravado[];
} {
  const ida: VinculoExtraGravado[] = [];
  const volta: VinculoExtraGravado[] = [];
  for (const vinculo of vinculos) {
    if (vinculo.repasse == null) {
      ida.push({ ...vinculo });
      volta.push({ ...vinculo });
      continue;
    }
    const [parteIda, parteVolta] = splitAmountInTwoHalves(vinculo.repasse);
    ida.push({ motoristaId: vinculo.motoristaId, repasse: parteIda > 0 ? parteIda : null });
    volta.push({ motoristaId: vinculo.motoristaId, repasse: parteVolta > 0 ? parteVolta : null });
  }
  return { ida, volta };
}

/**
 * O motorista principal vê o repasse da reserva.
 * O motorista extra vê só o valor marcado para ele, nunca o do principal nem o de outro extra.
 */
export function repasseVisivelNoPortal(opts: {
  acesso: string | null;
  repassePrincipal: number | null;
  repasseDesteMotorista: number | null;
}): number | null {
  if (opts.acesso === "extra") return opts.repasseDesteMotorista;
  return opts.repassePrincipal;
}

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

/** O repasse acompanha a ficha desta conta. Motorista de outro administrador continua de fora. */
export function resolverVinculosExtras(opts: {
  vinculos: VinculoExtraGravado[];
  primaryId?: string | null;
  motoristas: MotoristaDaFrota[];
  userId: string;
}): { vinculos: VinculoExtraGravado[]; recusados: string[] } {
  const { ids, recusados } = resolverMotoristasExtras({
    selecionados: opts.vinculos.map((v) => v.motoristaId),
    primaryId: opts.primaryId,
    motoristas: opts.motoristas,
    userId: opts.userId,
  });
  const repassePorFicha = new Map<string, number | null>();
  const dono = opts.userId.trim();
  for (const vinculo of opts.vinculos) {
    const ficha = opts.motoristas.find((m) => {
      if ((m.user_id ?? "").trim() && (m.user_id ?? "").trim() !== dono) return false;
      return m.id === vinculo.motoristaId || motoristaMatchesAssignment(vinculo.motoristaId, m);
    });
    if (!ficha?.id) continue;
    repassePorFicha.set(ficha.id.trim(), vinculo.repasse);
  }
  return {
    vinculos: ids.map((motoristaId) => ({
      motoristaId,
      repasse: repassePorFicha.get(motoristaId) ?? null,
    })),
    recusados,
  };
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

export async function listReservaMotoristasExtraComRepasse(
  kind: ReservaKind,
  reservaId: string,
): Promise<VinculoExtraGravado[]> {
  const { data, error } = await supabase
    .from("reserva_motoristas_extra")
    .select("motorista_id, repasse_valor")
    .eq("reserva_kind", kind)
    .eq("reserva_id", reservaId);
  if (error || !data) return [];
  return data.flatMap((row) => {
    const motoristaId = String(row.motorista_id ?? "").trim();
    if (!motoristaId) return [];
    const bruto = row.repasse_valor;
    const numero = bruto == null ? null : Number(bruto);
    const repasse = numero != null && Number.isFinite(numero) && numero > 0 ? Math.round(numero * 100) / 100 : null;
    return [{ motoristaId, repasse }];
  });
}

export async function listReservaMotoristasExtra(kind: ReservaKind, reservaId: string): Promise<string[]> {
  const rows = await listReservaMotoristasExtraComRepasse(kind, reservaId);
  return rows.map((row) => row.motoristaId);
}

/** Grava só os motoristas desta reserva e desta conta. Não altera outras reservas nem o motorista principal. */
export async function replaceReservaMotoristasExtra(opts: {
  userId: string;
  kind: ReservaKind;
  reservaId: string;
  motoristaIds?: string[];
  vinculos?: VinculoExtraGravado[];
  primaryId?: string | null;
}): Promise<string | null> {
  const frota = await supabase
    .from("solicitacoes_motoristas")
    .select("id, portal_auth_user_id, user_id")
    .eq("user_id", opts.userId)
    .eq("status", "cadastrado");
  if (frota.error) return frota.error.message;

  const entrada =
    opts.vinculos ??
    (opts.motoristaIds ?? []).map((motoristaId) => ({ motoristaId, repasse: null as number | null }));
  const { vinculos, recusados } = resolverVinculosExtras({
    vinculos: entrada,
    primaryId: opts.primaryId,
    motoristas: (frota.data ?? []) as MotoristaDaFrota[],
    userId: opts.userId,
  });
  if (recusados.length > 0) {
    return "Um dos motoristas marcados não pertence à sua frota. A reserva não foi vinculada a ele.";
  }
  const ids = vinculos;

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
      ids.map((vinculo) => ({
        user_id: opts.userId,
        reserva_kind: opts.kind,
        reserva_id: opts.reservaId,
        motorista_id: vinculo.motoristaId,
        repasse_valor: vinculo.repasse,
      })),
    )
    .select("id");
  if (inserted.error) return inserted.error.message;
  if ((inserted.data ?? []).length !== ids.length) {
    return "A reserva foi salva, mas o vínculo com os outros motoristas não foi confirmado.";
  }
  return null;
}
