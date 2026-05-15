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

/**
 * Monta o objeto usado no modal Comunicar: se existir par (ida+volta em duas linhas),
 * junta os dois registos para mostrar ida e volta; caso contrário, só remove campos confidenciais.
 */
export async function buildTransferDadosComunicarCliente(
  row: Tables<"reservas_transfer">,
): Promise<Record<string, unknown>> {
  const parId = (row as { par_reserva_id?: string | null }).par_reserva_id?.trim();
  if (!parId) {
    return omitComunicarConfidencial({ ...row } as Record<string, unknown>);
  }

  const { data: rows, error } = await supabase.from("reservas_transfer").select("*").eq("par_reserva_id", parId);
  if (error || !rows?.length) {
    return omitComunicarConfidencial({ ...row } as Record<string, unknown>);
  }

  const ida = rows.find((x) => (x as { perna_viagem?: string | null }).perna_viagem === "ida") ?? rows[0];
  const volta =
    rows.find((x) => (x as { perna_viagem?: string | null }).perna_viagem === "volta") ??
    rows.find((x) => x.id !== ida.id);
  if (!volta) {
    return omitComunicarConfidencial({ ...ida } as Record<string, unknown>);
  }

  const obs = [ida.observacoes, volta.observacoes].filter((s) => (s ?? "").toString().trim() !== "").join("\n\n");

  const merged: Record<string, unknown> = {
    ...omitComunicarConfidencial({ ...ida } as Record<string, unknown>),
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

  return merged;
}

export async function buildGrupoDadosComunicarCliente(
  row: Tables<"reservas_grupos">,
): Promise<Record<string, unknown>> {
  const parId = (row as { par_reserva_id?: string | null }).par_reserva_id?.trim();
  if (!parId) {
    return omitComunicarConfidencial({ ...row } as Record<string, unknown>);
  }

  const { data: rows, error } = await supabase.from("reservas_grupos").select("*").eq("par_reserva_id", parId);
  if (error || !rows?.length) {
    return omitComunicarConfidencial({ ...row } as Record<string, unknown>);
  }

  const ida = rows.find((x) => (x as { perna_viagem?: string | null }).perna_viagem === "ida") ?? rows[0];
  const volta =
    rows.find((x) => (x as { perna_viagem?: string | null }).perna_viagem === "volta") ??
    rows.find((x) => x.id !== ida.id);
  if (!volta) {
    return omitComunicarConfidencial({ ...ida } as Record<string, unknown>);
  }

  const obs = [ida.observacoes_viagem, volta.observacoes_viagem]
    .filter((s) => (s ?? "").toString().trim() !== "")
    .join("\n\n");

  const merged: Record<string, unknown> = {
    ...omitComunicarConfidencial({ ...ida } as Record<string, unknown>),
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

  return merged;
}
