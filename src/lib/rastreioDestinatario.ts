import type { Tables } from "@/integrations/supabase/types";

type ReservaTransfer = Tables<"reservas_transfer">;
type ReservaGrupo = Tables<"reservas_grupos">;

export type MotoristaFrotaOpt = {
  portalAuthUserId: string;
  nome: string;
  telefone: string | null;
};

export type CategoriaRastreio = "cliente" | "motorista";

function onlyDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

export function isCategoriaMotorista(categoria: string | null | undefined): boolean {
  return (categoria ?? "").trim().toLowerCase() === "motorista";
}

export function motoristaFrotaPorPortalUserId(
  motoristas: MotoristaFrotaOpt[],
  motoristaId: string | null | undefined,
): MotoristaFrotaOpt | null {
  const mid = (motoristaId ?? "").trim();
  if (!mid) return null;
  return motoristas.find((m) => m.portalAuthUserId === mid) ?? null;
}

function motoristaDaReserva(
  motoristas: MotoristaFrotaOpt[],
  reservaTransfer?: ReservaTransfer | null,
  reservaGrupo?: ReservaGrupo | null,
): { nome: string | null; telefone: string | null } {
  const mid = (reservaTransfer?.motorista_id ?? reservaGrupo?.motorista_id ?? "").trim();
  const frota = motoristaFrotaPorPortalUserId(motoristas, mid);
  const nomeGrupo = (reservaGrupo?.nome_motorista ?? "").trim();
  return {
    nome: frota?.nome?.trim() || nomeGrupo || null,
    telefone: onlyDigits(frota?.telefone) || null,
  };
}

function motoristaDoSnapshot(
  motoristas: MotoristaFrotaOpt[],
  reserva: Record<string, unknown>,
): { nome: string | null; telefone: string | null } {
  const mid = String(reserva.motorista_id ?? "").trim();
  const frota = motoristaFrotaPorPortalUserId(motoristas, mid);
  const nomeGrupo = String(reserva.nome_motorista ?? "").trim();
  return {
    nome: frota?.nome?.trim() || nomeGrupo || null,
    telefone: onlyDigits(frota?.telefone) || null,
  };
}

/** Nome exibido na página pública `/rastreio/:token`. */
export function nomeExibicaoPaginaPublica(r: {
  categoria_rastreamento: string | null;
  cliente_nome: string | null;
  motorista_nome: string | null;
}): string | null {
  if (isCategoriaMotorista(r.categoria_rastreamento)) {
    return r.motorista_nome?.trim() || r.cliente_nome?.trim() || null;
  }
  return r.cliente_nome?.trim() || null;
}

/** Destinatário do link (campos `cliente_nome` / `cliente_telefone` na BD). */
export function resolveDestinatarioAoCriar(params: {
  categoria: CategoriaRastreio;
  nomeOpcional: string;
  telefoneOpcional: string;
  reservaTransfer?: ReservaTransfer | null;
  reservaGrupo?: ReservaGrupo | null;
  motoristasFrota: MotoristaFrotaOpt[];
}): { nome: string | null; telefone: string | null } {
  const { categoria, nomeOpcional, telefoneOpcional, reservaTransfer, reservaGrupo, motoristasFrota } = params;

  if (categoria === "motorista") {
    const mot = motoristaDaReserva(motoristasFrota, reservaTransfer, reservaGrupo);
    const nome = nomeOpcional.trim() || mot.nome || null;
    const telDigits =
      onlyDigits(telefoneOpcional) || mot.telefone || null;
    return { nome, telefone: telDigits || null };
  }

  const nome =
    nomeOpcional.trim() ||
    reservaTransfer?.nome_completo?.trim() ||
    reservaGrupo?.nome_completo?.trim() ||
    null;
  const telDigits =
    onlyDigits(telefoneOpcional) ||
    onlyDigits(reservaTransfer?.telefone) ||
    onlyDigits(reservaGrupo?.whatsapp) ||
    null;
  return { nome, telefone: telDigits || null };
}

/** Destinatário ao clicar em Comunicar (corrige links antigos com dados do cliente). */
export function resolveDestinatarioComunicar(params: {
  categoria: string | null;
  clienteNome: string | null;
  clienteTelefone: string | null;
  reservaSnapshot: Record<string, unknown>;
  motoristasFrota: MotoristaFrotaOpt[];
}): { nome: string | null; telefone: string | null } {
  const { categoria, clienteNome, clienteTelefone, reservaSnapshot, motoristasFrota } = params;

  if (isCategoriaMotorista(categoria)) {
    const mot = motoristaDoSnapshot(motoristasFrota, reservaSnapshot);
    return {
      nome: mot.nome || clienteNome?.trim() || null,
      telefone: mot.telefone || onlyDigits(clienteTelefone) || null,
    };
  }

  return {
    nome: clienteNome?.trim() || null,
    telefone: onlyDigits(clienteTelefone) || null,
  };
}
