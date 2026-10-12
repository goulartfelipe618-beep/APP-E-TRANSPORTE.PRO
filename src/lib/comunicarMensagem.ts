import { formatComunicarValorCampo } from "@/lib/comunicarFieldFormat";
import { interpolarTextoComunicar, type ComunicarNomes } from "@/lib/comunicarPlaceholders";

export type VariavelComunicar = { key: string; label: string; value: string };

/** Variáveis só do registro passado. Não lê estado anterior nem localStorage. */
export function listarVariaveisComunicar(
  dados: Record<string, unknown>,
  labels: Record<string, string>,
  ignoredKeys: readonly string[],
): VariavelComunicar[] {
  return Object.entries(dados)
    .filter(([key, value]) => {
      if (ignoredKeys.includes(key) || value == null || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return formatComunicarValorCampo(key, value) !== "";
    })
    .map(([key, value]) => ({
      key,
      label: labels[key] || key,
      value: formatComunicarValorCampo(key, value),
    }));
}

/**
 * Monta o texto do WhatsApp a partir deste registro.
 * Cada chamada é independente: nada fica guardado entre envios.
 */
export function montarMensagemComunicar(opts: {
  dados: Record<string, unknown>;
  acima: string;
  abaixo: string;
  vars: Iterable<string>;
  nomes: ComunicarNomes;
  labels: Record<string, string>;
  ignoredKeys: readonly string[];
}): string {
  const escolhidas = new Set(opts.vars);
  const parts: string[] = [];
  const acima = interpolarTextoComunicar(opts.acima, opts.nomes).trim();
  const abaixo = interpolarTextoComunicar(opts.abaixo, opts.nomes).trim();
  if (acima) parts.push(acima);

  const linhas = listarVariaveisComunicar(opts.dados, opts.labels, opts.ignoredKeys).filter((v) =>
    escolhidas.has(v.key),
  );
  if (linhas.length > 0) {
    parts.push("");
    for (const v of linhas) parts.push(`*${v.label}:* ${v.value}`);
  }

  if (abaixo) {
    parts.push("");
    parts.push(abaixo);
  }

  return parts.join("\n");
}
