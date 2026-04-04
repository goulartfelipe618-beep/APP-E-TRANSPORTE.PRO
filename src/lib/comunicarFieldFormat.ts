/** Rótulos iguais ao PDF e às telas de detalhe (Transfer). */
const TIPO_VIAGEM_LABELS: Record<string, string> = {
  somente_ida: "Somente Ida",
  ida_volta: "Ida e Volta",
  por_hora: "Por Hora",
};

export function formatTipoViagemParaComunicar(raw: unknown): string {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  return TIPO_VIAGEM_LABELS[s] ?? s;
}

/** Alinhado a `pdfGenerator` / `DetalhesReservaTransferSheet`: motorista → Motorista; eu_mesmo → Eu mesmo. */
export function formatQuemViajaParaComunicar(raw: unknown): string {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim().toLowerCase();
  if (s === "motorista") return "Motorista";
  if (s === "eu_mesmo") return "Eu mesmo";
  return String(raw).trim();
}

/** Valor exibido na mensagem e nos chips do ComunicarDialog. */
export function formatComunicarValorCampo(key: string, value: unknown): string {
  if (value == null || value === "") return "";
  if (key === "tipo_viagem" || key === "tipo") {
    return formatTipoViagemParaComunicar(value);
  }
  if (key === "quem_viaja") {
    return formatQuemViajaParaComunicar(value);
  }
  return String(value);
}

/**
 * Clona o registro para o webhook com textos legíveis (sem enums com underscore).
 * Mantém as demais chaves inalteradas.
 */
export function dadosRegistroComunicarParaWebhook(dados: Record<string, unknown>): Record<string, unknown> {
  const base = JSON.parse(JSON.stringify(dados)) as Record<string, unknown>;
  if ("tipo_viagem" in base && base.tipo_viagem != null && base.tipo_viagem !== "") {
    base.tipo_viagem = formatTipoViagemParaComunicar(base.tipo_viagem);
  }
  if ("tipo" in base && base.tipo != null && base.tipo !== "") {
    const raw = String(base.tipo).trim();
    if (TIPO_VIAGEM_LABELS[raw]) {
      base.tipo = formatTipoViagemParaComunicar(base.tipo);
    }
  }
  if ("quem_viaja" in base && base.quem_viaja != null && base.quem_viaja !== "") {
    base.quem_viaja = formatQuemViajaParaComunicar(base.quem_viaja);
  }
  return base;
}
