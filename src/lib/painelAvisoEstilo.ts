/** Valores persistidos em `admin_avisos_plataforma.fonte`. */
export const AVISO_FONTE_VALUES = ["padrao", "serif", "mono", "arredondada"] as const;
export type AvisoFonte = (typeof AVISO_FONTE_VALUES)[number];

export const AVISO_FONTE_LABELS: Record<AvisoFonte, string> = {
  padrao: "Padrão do painel",
  serif: "Serifada (clássica)",
  mono: "Monoespaçada",
  arredondada: "Arredondada (UI)",
};

export function isAvisoFonte(v: string): v is AvisoFonte {
  return (AVISO_FONTE_VALUES as readonly string[]).includes(v);
}

/** Classes Tailwind para o parágrafo do aviso (uma combinação por registro). */
export function avisoFonteClassName(fonte: string): string {
  if (!isAvisoFonte(fonte)) return "";
  switch (fonte) {
    case "serif":
      return "font-serif";
    case "mono":
      return "font-mono";
    case "arredondada":
      return "[font-family:ui-rounded,'Segoe_UI','Segoe_UI_Emoji',system-ui,sans-serif]";
    default:
      return "";
  }
}
