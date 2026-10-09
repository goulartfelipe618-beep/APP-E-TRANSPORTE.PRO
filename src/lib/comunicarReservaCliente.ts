import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/** Nunca enviar ao cliente / webhook de comunicação (WhatsApp). */
export const COMUNICAR_CLIENTE_CHAVES_CONFIDENCIAIS = [
  "status",
  "numero_reserva",
  "repasse_motorista",
  "cadastro_cliente_id",
  "perna_viagem",
  "par_reserva_id",
] as const;

export const COMUNICAR_META_KEYS = ["_comunicar_reserva_ids", "_comunicar_motorista_ids"] as const;

export type ComunicarChaveConfidencial = (typeof COMUNICAR_CLIENTE_CHAVES_CONFIDENCIAIS)[number];

export function omitComunicarConfidencial<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const o = { ...row };
  for (const k of COMUNICAR_CLIENTE_CHAVES_CONFIDENCIAIS) {
    delete o[k];
  }
  return o;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function idsTexto(values: unknown[]): string[] {
  return [...new Set(values.map((v) => String(v ?? "").trim()).filter(Boolean))];
}

function anexarMeta(
  payload: Record<string, unknown>,
  rows: { id: string; motorista_id?: string | null }[],
): Record<string, unknown> {
  return {
    ...payload,
    _comunicar_reserva_ids: idsTexto(rows.map((r) => r.id)),
    _comunicar_motorista_ids: idsTexto(rows.map((r) => r.motorista_id)),
  };
}

export function lerComunicarReservaIds(dados: Record<string, unknown>): string[] {
  const extra = Array.isArray(dados._comunicar_reserva_ids) ? dados._comunicar_reserva_ids : [];
  return idsTexto([dados.id, ...extra]);
}

export function lerComunicarMotoristaIds(dados: Record<string, unknown>): string[] {
  const extra = Array.isArray(dados._comunicar_motorista_ids) ? dados._comunicar_motorista_ids : [];
  return idsTexto([dados.motorista_id, ...extra]);
}

/**
 * Monta o objeto usado no modal Comunicar a partir da linha gravada na base.
 * Se existir par (ida+volta em duas linhas), junta só esse par.
 */
export async function buildTransferDadosComunicarCliente(
  row: Tables<"reservas_transfer">,
): Promise<Record<string, unknown>> {
  const { data: fresh } = await supabase.from("reservas_transfer").select("*").eq("id", row.id).maybeSingle();
  const current = (fresh ?? row) as Tables<"reservas_transfer">;
  const parId = (current as { par_reserva_id?: string | null }).par_reserva_id?.trim();
  if (!parId) {
    return anexarMeta(omitComunicarConfidencial({ ...current } as Record<string, unknown>), [current]);
  }

  const { data: rows, error } = await supabase
    .from("reservas_transfer")
    .select("*")
    .eq("par_reserva_id", parId)
    .eq("user_id", current.user_id);
  if (error || !rows?.length) {
    return anexarMeta(omitComunicarConfidencial({ ...current } as Record<string, unknown>), [current]);
  }

  const ida = rows.find((x) => (x as { perna_viagem?: string | null }).perna_viagem === "ida") ?? rows[0];
  const volta =
    rows.find((x) => (x as { perna_viagem?: string | null }).perna_viagem === "volta") ??
    rows.find((x) => x.id !== ida.id);
  if (!volta) {
    return anexarMeta(omitComunicarConfidencial({ ...ida } as Record<string, unknown>), [ida]);
  }

  const obs = [ida.observacoes, volta.observacoes].filter((s) => (s ?? "").toString().trim() !== "").join("\n\n");

  const merged: Record<string, unknown> = {
    ...omitComunicarConfidencial({ ...ida } as Record<string, unknown>),
    id: current.id,
    user_id: current.user_id,
    motorista_id: current.motorista_id,
    tipo_viagem: "ida_volta",
    ida_embarque: ida.ida_embarque,
    ida_desembarque: ida.ida_desembarque,
    ida_data: ida.ida_data,
    ida_hora: ida.ida_hora,
    ida_passageiros: ida.ida_passageiros,
    ida_cupom: ida.ida_cupom,
    ida_mensagem: ida.ida_mensagem,
    volta_embarque: volta.ida_embarque,
    volta_desembarque: volta.ida_desembarque,
    volta_data: volta.ida_data,
    volta_hora: volta.ida_hora,
    volta_passageiros: volta.ida_passageiros,
    volta_cupom: volta.ida_cupom,
    volta_mensagem: volta.ida_mensagem,
    valor_base: num(ida.valor_base) + num(volta.valor_base),
    valor_total: num(ida.valor_total) + num(volta.valor_total),
    desconto: ida.desconto,
    metodo_pagamento: ida.metodo_pagamento ?? volta.metodo_pagamento,
    observacoes: obs || null,
  };

  return anexarMeta(merged, [ida, volta]);
}

export async function buildGrupoDadosComunicarCliente(
  row: Tables<"reservas_grupos">,
): Promise<Record<string, unknown>> {
  const { data: fresh } = await supabase.from("reservas_grupos").select("*").eq("id", row.id).maybeSingle();
  const current = (fresh ?? row) as Tables<"reservas_grupos">;
  const parId = (current as { par_reserva_id?: string | null }).par_reserva_id?.trim();
  if (!parId) {
    return anexarMeta(omitComunicarConfidencial({ ...current } as Record<string, unknown>), [current]);
  }

  const { data: rows, error } = await supabase
    .from("reservas_grupos")
    .select("*")
    .eq("par_reserva_id", parId)
    .eq("user_id", current.user_id);
  if (error || !rows?.length) {
    return anexarMeta(omitComunicarConfidencial({ ...current } as Record<string, unknown>), [current]);
  }

  const ida = rows.find((x) => (x as { perna_viagem?: string | null }).perna_viagem === "ida") ?? rows[0];
  const volta =
    rows.find((x) => (x as { perna_viagem?: string | null }).perna_viagem === "volta") ??
    rows.find((x) => x.id !== ida.id);
  if (!volta) {
    return anexarMeta(omitComunicarConfidencial({ ...ida } as Record<string, unknown>), [ida]);
  }

  const obs = [ida.observacoes_viagem, volta.observacoes_viagem]
    .filter((s) => (s ?? "").toString().trim() !== "")
    .join("\n\n");

  const merged: Record<string, unknown> = {
    ...omitComunicarConfidencial({ ...ida } as Record<string, unknown>),
    id: current.id,
    user_id: current.user_id,
    motorista_id: current.motorista_id,
    data_ida: ida.data_ida,
    hora_ida: ida.hora_ida,
    embarque: ida.embarque,
    destino: ida.destino,
    data_retorno: volta.data_ida,
    hora_retorno: volta.hora_ida,
    embarque_retorno: volta.embarque,
    destino_retorno: volta.destino,
    num_passageiros: ida.num_passageiros ?? volta.num_passageiros,
    cupom: ida.cupom ?? volta.cupom,
    observacoes_viagem: obs || null,
    valor_base: num(ida.valor_base) + num(volta.valor_base),
    valor_total: num(ida.valor_total) + num(volta.valor_total),
    desconto: ida.desconto,
    metodo_pagamento: ida.metodo_pagamento ?? volta.metodo_pagamento,
    tipo_veiculo: ida.tipo_veiculo ?? volta.tipo_veiculo,
  };

  return anexarMeta(merged, [ida, volta]);
}
