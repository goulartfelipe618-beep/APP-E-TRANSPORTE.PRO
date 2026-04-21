import type { Tables } from "@/integrations/supabase/types";

/** Reserva atribuída ao motorista OU criada por ele sem outro motorista definido (alinhado a Abrangência). */
export function transferVisivelMotoristaExecutivo(r: Tables<"reservas_transfer">, userId: string): boolean {
  const mid = (r.motorista_id ?? "").trim();
  if (mid === userId) return true;
  if (r.user_id === userId && mid === "") return true;
  return false;
}

export function grupoVisivelMotoristaExecutivo(r: Tables<"reservas_grupos">, userId: string): boolean {
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

export type AgendaItem = {
  key: string;
  reservaId: string;
  kind: "transfer" | "grupo";
  numeroLabel: string;
  /** Ex.: Ida, Volta, Por hora */
  perna: string;
  horario: string;
};

function pushItem(
  map: Map<string, AgendaItem[]>,
  dayKey: string | null,
  item: Omit<AgendaItem, "key"> & { key?: string },
): void {
  if (!dayKey) return;
  const key = item.key ?? `${item.kind}:${item.reservaId}:${item.perna}:${dayKey}`;
  const list = map.get(dayKey) ?? [];
  list.push({
    key,
    reservaId: item.reservaId,
    kind: item.kind,
    numeroLabel: item.numeroLabel,
    perna: item.perna,
    horario: item.horario,
  });
  map.set(dayKey, list);
}

/** Monta o mapa dia → linhas da agenda (só reservas, não solicitações). */
export function buildAgendaItemsPorDia(
  transfers: Tables<"reservas_transfer">[],
  grupos: Tables<"reservas_grupos">[],
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
        key: `transfer:${r.id}:por_hora`,
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
        key: `transfer:${r.id}:volta`,
      });
    }
  }

  for (const g of grupos) {
    if (!grupoVisivelMotoristaExecutivo(g, userId)) continue;
    if (isReservaCanceladaAgenda(g.status)) continue;
    const num = formatNumeroReservaPad(g.numero_reserva);

    const dkIda = toAgendaDayKey(g.data_ida);
    pushItem(map, dkIda, {
      reservaId: g.id,
      kind: "grupo",
      numeroLabel: num,
      perna: "Ida",
      horario: formatHoraReserva(g.hora_ida),
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
