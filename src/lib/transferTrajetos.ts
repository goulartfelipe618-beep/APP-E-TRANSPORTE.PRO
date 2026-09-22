export type TrajetoTransfer = {
  embarque: string;
  desembarque: string;
  data: string;
  hora: string;
  passageiros: number | null;
};

export type TrajetoTransferForm = {
  embarque: string;
  desembarque: string;
  data: string;
  hora: string;
  passageiros: string;
};

export const TIPO_MULTIPLOS_TRAJETOS = "multiplos_trajetos" as const;
export const MAX_TRAJETOS_TRANSFER = 12;

export function emptyTrajetoForm(): TrajetoTransferForm {
  return { embarque: "", desembarque: "", data: "", hora: "", passageiros: "" };
}

export function defaultMultiplosTrajetosForm(): TrajetoTransferForm[] {
  return [emptyTrajetoForm(), emptyTrajetoForm()];
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function parseTrajetosTransfer(raw: unknown): TrajetoTransfer[] {
  if (!Array.isArray(raw)) return [];
  const out: TrajetoTransfer[] = [];
  for (const item of raw) {
    const o = asRecord(item);
    if (!o) continue;
    const embarque = String(o.embarque ?? "").trim();
    const desembarque = String(o.desembarque ?? "").trim();
    const data = String(o.data ?? "").trim();
    const hora = String(o.hora ?? "").trim();
    const p = o.passageiros == null || o.passageiros === "" ? null : Number(o.passageiros);
    out.push({
      embarque,
      desembarque,
      data,
      hora,
      passageiros: Number.isFinite(p as number) ? (p as number) : null,
    });
  }
  return out;
}

export function trajetosToForm(raw: unknown): TrajetoTransferForm[] {
  const parsed = parseTrajetosTransfer(raw).map((t) => ({
    embarque: t.embarque,
    desembarque: t.desembarque,
    data: t.data,
    hora: t.hora,
    passageiros: t.passageiros != null ? String(t.passageiros) : "",
  }));
  if (parsed.length >= 2) return parsed.slice(0, MAX_TRAJETOS_TRANSFER);
  while (parsed.length < 2) parsed.push(emptyTrajetoForm());
  return parsed;
}

export function validateTrajetosForm(rows: TrajetoTransferForm[]): string | null {
  if (rows.length < 2) return "Informe pelo menos 2 trajetos (paradas).";
  if (rows.length > MAX_TRAJETOS_TRANSFER) return `No máximo ${MAX_TRAJETOS_TRANSFER} trajetos.`;
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i];
    if (!t.embarque.trim() || !t.desembarque.trim() || !t.data.trim()) {
      return `Preencha embarque, desembarque e data do trajeto ${i + 1}.`;
    }
    if (!t.passageiros.trim() || Number(t.passageiros) < 1) {
      return `Informe o número de passageiros do trajeto ${i + 1}.`;
    }
  }
  return null;
}

export function serializeTrajetosForm(rows: TrajetoTransferForm[]): TrajetoTransfer[] {
  return rows.map((t) => ({
    embarque: t.embarque.trim(),
    desembarque: t.desembarque.trim(),
    data: t.data.trim(),
    hora: t.hora.trim(),
    passageiros: t.passageiros ? parseInt(t.passageiros, 10) : null,
  }));
}

export function mirrorPrimeiroUltimoTrajeto(rows: TrajetoTransfer[]) {
  const first = rows[0];
  const last = rows[rows.length - 1];
  return {
    ida_embarque: first?.embarque || null,
    ida_desembarque: last?.desembarque || first?.desembarque || null,
    ida_data: first?.data || null,
    ida_hora: first?.hora || null,
    ida_passageiros: first?.passageiros ?? null,
  };
}
