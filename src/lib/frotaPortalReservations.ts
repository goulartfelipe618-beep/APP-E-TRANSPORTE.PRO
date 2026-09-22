import { supabase } from "@/integrations/supabase/client";

export type FrotaPortalTransferReserva = {
  kind: "transfer";
  id: string;
  numero_reserva: number;
  status: string | null;
  motorista_id: string | null;
  tipo_viagem: string | null;
  /** Ida/volta persistido em duas linhas (`somente_ida` + metadados). */
  perna_viagem?: string | null;
  ida_data: string | null;
  ida_hora: string | null;
  volta_data: string | null;
  volta_hora: string | null;
  por_hora_data: string | null;
  por_hora_hora: string | null;
  ida_embarque: string | null;
  ida_desembarque: string | null;
  volta_embarque: string | null;
  volta_desembarque: string | null;
  por_hora_endereco_inicio: string | null;
  por_hora_ponto_encerramento: string | null;
  num_passageiros: number | null;
  valor_base: number | null;
  desconto: number | null;
  valor_total: number | null;
  repasse_motorista: number | null;
  observacoes: string | null;
  faturado: boolean;
  esconder_valores: boolean;
  categoria_veiculo: string | null;
  trajetos?: unknown;
};

export type FrotaPortalGrupoReserva = {
  kind: "grupo";
  id: string;
  numero_reserva: number;
  status: string | null;
  motorista_id: string | null;
  perna_viagem?: string | null;
  data_ida: string | null;
  hora_ida: string | null;
  data_retorno: string | null;
  hora_retorno: string | null;
  embarque: string | null;
  destino: string | null;
  num_passageiros: number | null;
  valor_base: number | null;
  desconto: number | null;
  valor_total: number | null;
  repasse_motorista: number | null;
  observacoes: string | null;
};

export type FrotaPortalReserva = FrotaPortalTransferReserva | FrotaPortalGrupoReserva;

function parseRpcStatus(data: unknown): string {
  if (typeof data === "string") return data.trim();
  if (Array.isArray(data) && typeof data[0] === "string") return data[0].trim();
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    const nested = rec.frota_update_reserva_status ?? rec.status;
    if (typeof nested === "string") return nested.trim();
  }
  return "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function reservaNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseReserva(raw: unknown): FrotaPortalReserva | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = r.kind === "transfer" || r.kind === "grupo" ? r.kind : null;
  const idRaw = r.id;
  const id =
    typeof idRaw === "string" && idRaw.trim()
      ? idRaw.trim()
      : idRaw != null
        ? String(idRaw)
        : null;
  if (!kind || !id) return null;

  if (kind === "transfer") {
    return {
      kind,
      id,
      numero_reserva: reservaNumber(r.numero_reserva),
      status: nullableString(r.status),
      motorista_id: nullableString(r.motorista_id),
      tipo_viagem: nullableString(r.tipo_viagem),
      perna_viagem: nullableString(r.perna_viagem),
      ida_data: nullableString(r.ida_data),
      ida_hora: nullableString(r.ida_hora),
      volta_data: nullableString(r.volta_data),
      volta_hora: nullableString(r.volta_hora),
      por_hora_data: nullableString(r.por_hora_data),
      por_hora_hora: nullableString(r.por_hora_hora),
      ida_embarque: nullableString(r.ida_embarque),
      ida_desembarque: nullableString(r.ida_desembarque),
      volta_embarque: nullableString(r.volta_embarque),
      volta_desembarque: nullableString(r.volta_desembarque),
      por_hora_endereco_inicio: nullableString(r.por_hora_endereco_inicio),
      por_hora_ponto_encerramento: nullableString(r.por_hora_ponto_encerramento),
      num_passageiros:
        nullableNumber(r.num_passageiros) ??
        (nullableString(r.tipo_viagem) === "por_hora"
          ? nullableNumber(r.por_hora_passageiros)
          : nullableString(r.perna_viagem) === "volta"
            ? nullableNumber(r.volta_passageiros) ?? nullableNumber(r.ida_passageiros)
            : nullableNumber(r.ida_passageiros)),
      valor_base: nullableNumber(r.valor_base),
      desconto: nullableNumber(r.desconto),
      valor_total: nullableNumber(r.valor_total),
      repasse_motorista: nullableNumber(r.repasse_motorista),
      observacoes: nullableString(r.observacoes),
      faturado: r.faturado === true,
      esconder_valores: r.esconder_valores === true,
      categoria_veiculo: nullableString(r.categoria_veiculo),
      trajetos: r.trajetos,
    };
  }

  return {
    kind,
    id,
    numero_reserva: reservaNumber(r.numero_reserva),
    status: nullableString(r.status),
    motorista_id: nullableString(r.motorista_id),
    perna_viagem: nullableString(r.perna_viagem),
    data_ida: nullableString(r.data_ida),
    hora_ida: nullableString(r.hora_ida),
    data_retorno: nullableString(r.data_retorno),
    hora_retorno: nullableString(r.hora_retorno),
    embarque: nullableString(r.embarque),
    destino: nullableString(r.destino),
    num_passageiros: nullableNumber(r.num_passageiros),
    valor_base: nullableNumber(r.valor_base),
    desconto: nullableNumber(r.desconto),
    valor_total: nullableNumber(r.valor_total),
    repasse_motorista: nullableNumber(r.repasse_motorista),
    observacoes: nullableString(r.observacoes),
  };
}

async function listFrotaPortalReservationsFallback(): Promise<{
  transfers: FrotaPortalTransferReserva[];
  grupos: FrotaPortalGrupoReserva[];
  error: string | null;
}> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { transfers: [], grupos: [], error: "Sessão inválida" };

  const { data: cadastros } = await supabase
    .from("solicitacoes_motoristas")
    .select("id")
    .eq("portal_auth_user_id", uid)
    .eq("status", "cadastrado");
  const assignIds = Array.from(
    new Set([uid, ...(cadastros ?? []).map((row) => String(row.id)).filter(Boolean)]),
  );

  const [tRes, gRes] = await Promise.all([
    supabase.from("reservas_transfer").select("*").in("motorista_id", assignIds),
    supabase.from("reservas_grupos").select("*").in("motorista_id", assignIds),
  ]);
  if (tRes.error) return { transfers: [], grupos: [], error: tRes.error.message };
  if (gRes.error) return { transfers: [], grupos: [], error: gRes.error.message };

  const transfers = (tRes.data || [])
    .map((row) => parseReserva({ kind: "transfer", ...row }))
    .filter((r): r is FrotaPortalTransferReserva => r?.kind === "transfer");
  const grupos = (gRes.data || [])
    .map((row) => parseReserva({ kind: "grupo", ...row }))
    .filter((r): r is FrotaPortalGrupoReserva => r?.kind === "grupo");
  return { transfers, grupos, error: null };
}

export async function listFrotaPortalReservations(): Promise<{
  transfers: FrotaPortalTransferReserva[];
  grupos: FrotaPortalGrupoReserva[];
  error: string | null;
}> {
  const { data, error } = await supabase.rpc("get_frota_motorista_reservas");
  if (!error) {
    const rows = Array.isArray(data) ? data.map(parseReserva).filter((r): r is FrotaPortalReserva => r != null) : [];
    return {
      transfers: rows.filter((r): r is FrotaPortalTransferReserva => r.kind === "transfer"),
      grupos: rows.filter((r): r is FrotaPortalGrupoReserva => r.kind === "grupo"),
      error: null,
    };
  }
  return listFrotaPortalReservationsFallback();
}

export async function updateFrotaReservaStatus(
  kind: "transfer" | "grupo",
  id: string,
  status: string,
): Promise<{ status: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("frota_update_reserva_status", {
    p_kind: kind,
    p_id: id,
    p_status: status,
  });
  if (error) return { status: null, error: error.message };
  const saved = parseRpcStatus(data);
  if (!saved) return { status: null, error: "O estado não ficou gravado. Tente novamente." };
  return { status: saved, error: null };
}
