import { primeiroSegmentoEndereco } from "@/lib/abrangenciaMapHelpers";

export type TransferAgendaReserva = {
  id: string;
  user_id?: string | null;
  motorista_id: string | null;
  tipo_viagem: string | null;
  /** Quando ida+volta foi persistido em duas linhas (`somente_ida` + metadados). */
  perna_viagem?: string | null;
  numero_reserva: number;
  status: string | null;
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
};

export type GrupoAgendaReserva = {
  id: string;
  user_id?: string | null;
  motorista_id: string | null;
  numero_reserva: number;
  status: string | null;
  perna_viagem?: string | null;
  data_ida: string | null;
  hora_ida: string | null;
  data_retorno: string | null;
  hora_retorno: string | null;
  embarque: string | null;
  destino: string | null;
};

/** Reserva atribuída ao motorista OU criada por ele sem outro motorista definido (alinhado a Abrangência). */
export function transferVisivelMotoristaExecutivo(r: TransferAgendaReserva, userId: string): boolean {
  const mid = (r.motorista_id ?? "").trim();
  if (mid === userId) return true;
  if (r.user_id === userId && mid === "") return true;
  return false;
}

export function grupoVisivelMotoristaExecutivo(r: GrupoAgendaReserva, userId: string): boolean {
  if (r.motorista_id != null && r.motorista_id === userId) return true;
  if (r.user_id === userId && r.motorista_id == null) return true;
  return false;
}

export function formatNumeroReservaPad(n: number): string {
  return `#${String(Math.max(0, Math.floor(n))).padStart(4, "0")}`;
}

/** Normaliza data guardada (YYYY-MM-DD ou ISO) para chave YYYY-MM-DD em calendário local. */
export function toAgendaDayKey(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/** Data de calendário (YYYY-MM-DD vinda do Postgres / input type=date) em pt-BR — evita `new Date("YYYY-MM-DD")` (UTC). */
export function formatDbCalendarDatePtBr(raw: string | null | undefined): string {
  const key = toAgendaDayKey(raw);
  if (!key) return "—";
  const [y, mo, d] = key.split("-");
  return `${d}/${mo}/${y}`;
}

/** Mesmo calendário, formato curto para PDF (ex.: 06 JUN). */
export function formatDbCalendarDatePtBrShortMonth(raw: string | null | undefined): string {
  const key = toAgendaDayKey(raw);
  if (!key) return "—";
  const parts = key.split("-").map((x) => Number(x));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return "—";
  const [y, mo, d] = parts as [number, number, number];
  const dt = new Date(y, mo - 1, d);
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).toUpperCase();
}

export function formatHoraReserva(h: string | null | undefined): string {
  const t = (h ?? "").trim();
  if (!t) return "—";
  if (/^\d{1,2}:\d{2}/.test(t)) return t.slice(0, 5);
  const d = new Date(t);
  if (Number.isFinite(d.getTime())) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return t;
}

export function isReservaCanceladaAgenda(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s.includes("cancel");
}

/** Alinhado ao mapa de Abrangência: viagem já realizada / encerrada. */
export function isReservaConcluidaAgenda(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase().trim();
  if (!s) return false;
  const keys = ["concluí", "concluid", "realiz", "finaliz", "complet", "feito", "atend", "encerr"];
  return keys.some((k) => s.includes(k));
}

/** Instantâneo local do slot (dia da célula + hora; meio-dia se hora ausente). */
export function parseAgendaInstantMs(dayKey: string, horario: string): number {
  const parts = dayKey.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return Date.now();
  const [y, mo, d] = parts as [number, number, number];
  let hh = 12;
  let mm = 0;
  const t = (horario ?? "").trim();
  if (t && t !== "—") {
    const m = /^(\d{1,2}):(\d{2})/.exec(t);
    if (m) {
      hh = Math.min(23, Math.max(0, Number(m[1])));
      mm = Math.min(59, Math.max(0, Number(m[2])));
    }
  }
  return new Date(y, mo - 1, d, hh, mm, 0, 0).getTime();
}

function trajetoTransferLeg(r: TransferAgendaReserva, leg: "ida" | "volta" | "por_hora"): string {
  if (leg === "por_hora") {
    const a = primeiroSegmentoEndereco(r.por_hora_endereco_inicio) || "—";
    const b = (r.por_hora_ponto_encerramento || "").trim() || "—";
    return `${a} → ${b}`;
  }
  if (leg === "ida") {
    const a = primeiroSegmentoEndereco(r.ida_embarque) || "—";
    const b = (r.ida_desembarque || "").trim() || "—";
    return `${a} → ${b}`;
  }
  const a = primeiroSegmentoEndereco(r.volta_embarque) || "—";
  const b = (r.volta_desembarque || "").trim() || "—";
  return `${a} → ${b}`;
}

function trajetoGrupoResumo(g: GrupoAgendaReserva): string {
  const a = primeiroSegmentoEndereco(g.embarque) || "—";
  const b = (g.destino || "").trim() || "—";
  return `${a} → ${b}`;
}

export type AgendaItem = {
  key: string;
  reservaId: string;
  kind: "transfer" | "grupo";
  numeroLabel: string;
  /** Ex.: Ida, Volta, Por hora */
  perna: string;
  horario: string;
  trajetoResumo: string;
  status: string | null;
  instanteAgendaMs: number;
};

/** Vermelho no código: já passou o horário do slot ou reserva concluída. */
export function agendaItemCodigoNoPassado(it: AgendaItem, nowMs: number = Date.now()): boolean {
  if (isReservaConcluidaAgenda(it.status)) return true;
  return it.instanteAgendaMs < nowMs;
}

function pushItem(
  map: Map<string, AgendaItem[]>,
  dayKey: string | null,
  item: Omit<AgendaItem, "key" | "instanteAgendaMs"> & { key?: string },
): void {
  if (!dayKey) return;
  const key = item.key ?? `${item.kind}:${item.reservaId}:${item.perna}:${dayKey}`;
  const instanteAgendaMs = parseAgendaInstantMs(dayKey, item.horario);
  const list = map.get(dayKey) ?? [];
  list.push({
    key,
    reservaId: item.reservaId,
    kind: item.kind,
    numeroLabel: item.numeroLabel,
    perna: item.perna,
    horario: item.horario,
    trajetoResumo: item.trajetoResumo,
    status: item.status,
    instanteAgendaMs,
  });
  map.set(dayKey, list);
}

/** Monta o mapa dia → linhas da agenda (só reservas, não solicitações). */
/** Só reservas com motorista_id = utilizador (motorista da frota atribuído). */
export function transferVisivelSomenteAtribuido(r: TransferAgendaReserva, motoristaAuthId: string): boolean {
  return (r.motorista_id ?? "").trim() === motoristaAuthId;
}

export function grupoVisivelSomenteAtribuido(g: GrupoAgendaReserva, motoristaAuthId: string): boolean {
  return g.motorista_id != null && g.motorista_id === motoristaAuthId;
}

/** Agenda do submotorista: apenas serviços atribuídos a ele (auth uid). */
export function buildAgendaItemsPorDiaAtribuidoSomente(
  transfers: TransferAgendaReserva[],
  grupos: GrupoAgendaReserva[],
  motoristaAuthId: string,
): Map<string, AgendaItem[]> {
  const map = new Map<string, AgendaItem[]>();

  for (const r of transfers) {
    if (!transferVisivelSomenteAtribuido(r, motoristaAuthId)) continue;
    if (isReservaCanceladaAgenda(r.status)) continue;
    const num = formatNumeroReservaPad(r.numero_reserva);

    if (r.tipo_viagem === "por_hora") {
      const dk = toAgendaDayKey(r.por_hora_data);
      pushItem(map, dk, {
        reservaId: r.id,
        kind: "transfer",
        numeroLabel: num,
        perna: "Por hora",
        horario: formatHoraReserva(r.por_hora_hora),
        trajetoResumo: trajetoTransferLeg(r, "por_hora"),
        status: r.status,
        key: `transfer:${r.id}:por_hora`,
      });
      continue;
    }

    const pernaMeta = (r.perna_viagem ?? "").trim().toLowerCase();
    if (r.tipo_viagem === "somente_ida" && (pernaMeta === "ida" || pernaMeta === "volta")) {
      const dk = toAgendaDayKey(r.ida_data);
      const labelPerna = pernaMeta === "volta" ? "Volta" : "Ida";
      pushItem(map, dk, {
        reservaId: r.id,
        kind: "transfer",
        numeroLabel: num,
        perna: labelPerna,
        horario: formatHoraReserva(r.ida_hora),
        trajetoResumo: trajetoTransferLeg(r, "ida"),
        status: r.status,
        key: `transfer:${r.id}:perna:${pernaMeta}`,
      });
      continue;
    }

    const dkIda = toAgendaDayKey(r.ida_data);
    pushItem(map, dkIda, {
      reservaId: r.id,
      kind: "transfer",
      numeroLabel: num,
      perna: "Ida",
      horario: formatHoraReserva(r.ida_hora),
      trajetoResumo: trajetoTransferLeg(r, "ida"),
      status: r.status,
      key: `transfer:${r.id}:ida`,
    });

    if (r.tipo_viagem === "ida_volta") {
      const dkVolta = toAgendaDayKey(r.volta_data);
      pushItem(map, dkVolta, {
        reservaId: r.id,
        kind: "transfer",
        numeroLabel: num,
        perna: "Volta",
        horario: formatHoraReserva(r.volta_hora),
        trajetoResumo: trajetoTransferLeg(r, "volta"),
        status: r.status,
        key: `transfer:${r.id}:volta`,
      });
    }
  }

  for (const g of grupos) {
    if (!grupoVisivelSomenteAtribuido(g, motoristaAuthId)) continue;
    if (isReservaCanceladaAgenda(g.status)) continue;
    const num = formatNumeroReservaPad(g.numero_reserva);
    const traj = trajetoGrupoResumo(g);

    const pernaG = (g.perna_viagem ?? "").trim().toLowerCase();
    if (pernaG === "ida" || pernaG === "volta") {
      const dk = toAgendaDayKey(g.data_ida);
      const labelPerna = pernaG === "volta" ? "Volta" : "Ida";
      pushItem(map, dk, {
        reservaId: g.id,
        kind: "grupo",
        numeroLabel: num,
        perna: labelPerna,
        horario: formatHoraReserva(g.hora_ida),
        trajetoResumo: traj,
        status: g.status,
        key: `grupo:${g.id}:perna:${pernaG}`,
      });
      continue;
    }

    const dkIda = toAgendaDayKey(g.data_ida);
    pushItem(map, dkIda, {
      reservaId: g.id,
      kind: "grupo",
      numeroLabel: num,
      perna: "Ida",
      horario: formatHoraReserva(g.hora_ida),
      trajetoResumo: traj,
      status: g.status,
      key: `grupo:${g.id}:ida`,
    });

    const dkVolta = toAgendaDayKey(g.data_retorno);
    if (dkVolta) {
      pushItem(map, dkVolta, {
        reservaId: g.id,
        kind: "grupo",
        numeroLabel: num,
        perna: "Volta",
        horario: formatHoraReserva(g.hora_retorno),
        trajetoResumo: traj,
        status: g.status,
        key: `grupo:${g.id}:volta`,
      });
    }
  }

  for (const [, arr] of map) {
    arr.sort((a, b) => {
      const ta = a.horario === "—" ? "99:99" : a.horario;
      const tb = b.horario === "—" ? "99:99" : b.horario;
      if (ta !== tb) return ta.localeCompare(tb);
      return a.numeroLabel.localeCompare(b.numeroLabel);
    });
  }

  return map;
}

export function buildAgendaItemsPorDia(
  transfers: TransferAgendaReserva[],
  grupos: GrupoAgendaReserva[],
  userId: string,
): Map<string, AgendaItem[]> {
  const map = new Map<string, AgendaItem[]>();

  for (const r of transfers) {
    if (!transferVisivelMotoristaExecutivo(r, userId)) continue;
    if (isReservaCanceladaAgenda(r.status)) continue;
    const num = formatNumeroReservaPad(r.numero_reserva);

    if (r.tipo_viagem === "por_hora") {
      const dk = toAgendaDayKey(r.por_hora_data);
      pushItem(map, dk, {
        reservaId: r.id,
        kind: "transfer",
        numeroLabel: num,
        perna: "Por hora",
        horario: formatHoraReserva(r.por_hora_hora),
        trajetoResumo: trajetoTransferLeg(r, "por_hora"),
        status: r.status,
        key: `transfer:${r.id}:por_hora`,
      });
      continue;
    }

    const pernaMeta = (r.perna_viagem ?? "").trim().toLowerCase();
    if (r.tipo_viagem === "somente_ida" && (pernaMeta === "ida" || pernaMeta === "volta")) {
      const dk = toAgendaDayKey(r.ida_data);
      const labelPerna = pernaMeta === "volta" ? "Volta" : "Ida";
      pushItem(map, dk, {
        reservaId: r.id,
        kind: "transfer",
        numeroLabel: num,
        perna: labelPerna,
        horario: formatHoraReserva(r.ida_hora),
        trajetoResumo: trajetoTransferLeg(r, "ida"),
        status: r.status,
        key: `transfer:${r.id}:perna:${pernaMeta}`,
      });
      continue;
    }

    const dkIda = toAgendaDayKey(r.ida_data);
    pushItem(map, dkIda, {
      reservaId: r.id,
      kind: "transfer",
      numeroLabel: num,
      perna: "Ida",
      horario: formatHoraReserva(r.ida_hora),
      trajetoResumo: trajetoTransferLeg(r, "ida"),
      status: r.status,
      key: `transfer:${r.id}:ida`,
    });

    if (r.tipo_viagem === "ida_volta") {
      const dkVolta = toAgendaDayKey(r.volta_data);
      pushItem(map, dkVolta, {
        reservaId: r.id,
        kind: "transfer",
        numeroLabel: num,
        perna: "Volta",
        horario: formatHoraReserva(r.volta_hora),
        trajetoResumo: trajetoTransferLeg(r, "volta"),
        status: r.status,
        key: `transfer:${r.id}:volta`,
      });
    }
  }

  for (const g of grupos) {
    if (!grupoVisivelMotoristaExecutivo(g, userId)) continue;
    if (isReservaCanceladaAgenda(g.status)) continue;
    const num = formatNumeroReservaPad(g.numero_reserva);
    const traj = trajetoGrupoResumo(g);

    const pernaG = (g.perna_viagem ?? "").trim().toLowerCase();
    if (pernaG === "ida" || pernaG === "volta") {
      const dk = toAgendaDayKey(g.data_ida);
      const labelPerna = pernaG === "volta" ? "Volta" : "Ida";
      pushItem(map, dk, {
        reservaId: g.id,
        kind: "grupo",
        numeroLabel: num,
        perna: labelPerna,
        horario: formatHoraReserva(g.hora_ida),
        trajetoResumo: traj,
        status: g.status,
        key: `grupo:${g.id}:perna:${pernaG}`,
      });
      continue;
    }

    const dkIda = toAgendaDayKey(g.data_ida);
    pushItem(map, dkIda, {
      reservaId: g.id,
      kind: "grupo",
      numeroLabel: num,
      perna: "Ida",
      horario: formatHoraReserva(g.hora_ida),
      trajetoResumo: traj,
      status: g.status,
      key: `grupo:${g.id}:ida`,
    });

    const dkVolta = toAgendaDayKey(g.data_retorno);
    if (dkVolta) {
      pushItem(map, dkVolta, {
        reservaId: g.id,
        kind: "grupo",
        numeroLabel: num,
        perna: "Volta",
        horario: formatHoraReserva(g.hora_retorno),
        trajetoResumo: traj,
        status: g.status,
        key: `grupo:${g.id}:volta`,
      });
    }
  }

  for (const [, arr] of map) {
    arr.sort((a, b) => {
      const ta = a.horario === "—" ? "99:99" : a.horario;
      const tb = b.horario === "—" ? "99:99" : b.horario;
      if (ta !== tb) return ta.localeCompare(tb);
      return a.numeroLabel.localeCompare(b.numeroLabel);
    });
  }

  return map;
}
