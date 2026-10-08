import { supabase } from "@/integrations/supabase/client";

export type ReservaKind = "transfer" | "grupo";

type ExtraQuery = {
  select: (cols: string) => {
    eq: (col: string, value: string) => ExtraQuery & Promise<{ data: { motorista_id: string; reserva_id?: string }[] | null; error: { message: string } | null }>;
  };
  delete: () => ExtraQuery;
  insert: (rows: { user_id: string; reserva_kind: string; reserva_id: string; motorista_id: string }[]) => Promise<{ error: { message: string } | null }>;
  eq: (col: string, value: string) => ExtraQuery & Promise<{ error: { message: string } | null }>;
};

function extraTable(): ExtraQuery {
  return (supabase as unknown as { from: (name: string) => ExtraQuery }).from("reserva_motoristas_extra");
}

export async function listExtrasDoOperador(
  kind: ReservaKind,
  userId: string,
): Promise<{ reserva_id: string; motorista_id: string }[]> {
  const { data, error } = await extraTable().select("reserva_id, motorista_id").eq("reserva_kind", kind).eq("user_id", userId);
  if (error || !data) return [];
  return data
    .map((row) => ({ reserva_id: String(row.reserva_id ?? ""), motorista_id: String(row.motorista_id ?? "").trim() }))
    .filter((row) => row.reserva_id && row.motorista_id);
}

export async function listReservaMotoristasExtra(kind: ReservaKind, reservaId: string): Promise<string[]> {
  const { data, error } = await extraTable()
    .select("motorista_id")
    .eq("reserva_kind", kind)
    .eq("reserva_id", reservaId);
  if (error || !data) return [];
  return data.map((row) => String(row.motorista_id ?? "").trim()).filter(Boolean);
}

/** Grava só os motoristas desta reserva. Não altera outras reservas nem o motorista principal já salvo. */
export async function replaceReservaMotoristasExtra(opts: {
  userId: string;
  kind: ReservaKind;
  reservaId: string;
  motoristaIds: string[];
  primaryId?: string | null;
}): Promise<string | null> {
  const primary = (opts.primaryId ?? "").trim();
  const ids = [...new Set(opts.motoristaIds.map((id) => id.trim()).filter((id) => id && id !== primary))];
  const removed = await extraTable()
    .delete()
    .eq("reserva_kind", opts.kind)
    .eq("reserva_id", opts.reservaId)
    .eq("user_id", opts.userId);
  if (removed.error) return removed.error.message;
  if (ids.length === 0) return null;
  const inserted = await extraTable().insert(
    ids.map((motorista_id) => ({
      user_id: opts.userId,
      reserva_kind: opts.kind,
      reserva_id: opts.reservaId,
      motorista_id,
    })),
  );
  return inserted.error?.message ?? null;
}
