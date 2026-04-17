/**
 * Fontes globais do sistema.
 *
 * Mantidas num único sítio para que a página de Configurações, o contexto
 * `ConfiguracoesProvider` e qualquer preview partilhem exatamente os mesmos
 * identificadores (`value`) e os valores de `font-family` aplicados no CSS.
 *
 * IMPORTANTE: se acrescentares uma fonte nova aqui, garante que ela também
 * é carregada em `index.html` via Google Fonts e permitida pelo CSP em
 * `vercel.json` (style-src/font-src).
 */

export type FonteGlobalValue =
  | "montserrat"
  | "inter"
  | "roboto"
  | "opensans"
  | "lato"
  | "poppins";

export interface FonteGlobalOption {
  value: FonteGlobalValue;
  label: string;
  /** Valor CSS seguro (com aspas em famílias multi-palavra e fallback). */
  css: string;
}

export const FONTES_GLOBAIS: ReadonlyArray<FonteGlobalOption> = [
  { value: "montserrat", label: "Montserrat", css: "'Montserrat', sans-serif" },
  { value: "inter", label: "Inter", css: "'Inter', sans-serif" },
  { value: "roboto", label: "Roboto", css: "'Roboto', sans-serif" },
  { value: "opensans", label: "Open Sans", css: "'Open Sans', sans-serif" },
  { value: "lato", label: "Lato", css: "'Lato', sans-serif" },
  { value: "poppins", label: "Poppins", css: "'Poppins', sans-serif" },
] as const;

export const FONTE_GLOBAL_PADRAO: FonteGlobalValue = "montserrat";

export function resolveFonteCss(value: string | null | undefined): string {
  const found = FONTES_GLOBAIS.find((f) => f.value === value);
  if (found) return found.css;
  return FONTES_GLOBAIS.find((f) => f.value === FONTE_GLOBAL_PADRAO)!.css;
}
