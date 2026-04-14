import QRCode from "qrcode";

/** Tamanhos de exportação (px). */
export const QR_EXPORT_SIZES = {
  pequeno: 512,
  medio: 1024,
  grande: 2048,
} as const;

export type QrExportSizeId = keyof typeof QR_EXPORT_SIZES;

/** Esquema: light = módulos escuros (preto) em fundo claro; dark = módulos claros (branco) em fundo escuro. */
export type QrColorScheme = "light" | "dark";

export interface QrExportOptions {
  sizePx: number;
  scheme: QrColorScheme;
  /** true = fundo branco ou preto sólido; false = fundo transparente nos “módulos claros” (PNG). */
  solidBackground: boolean;
}

/**
 * Cores para a biblioteca `qrcode`: `dark` = módulos ativos do símbolo, `light` = módulos inativos + margem.
 * Usar hex (#RRGGBB ou #RRGGBBAA) — a lib converte internamente.
 */
export function buildQrModuleColors(
  scheme: QrColorScheme,
  solidBackground: boolean,
): { dark: string; light: string } {
  if (scheme === "light") {
    return {
      dark: "#000000",
      light: solidBackground ? "#ffffff" : "#00000000",
    };
  }
  return {
    dark: "#ffffff",
    light: solidBackground ? "#000000" : "#00000000",
  };
}

/** Cores para pré-visualização com `qrcode.react` (fg = módulos, bg = fundo). */
export function getQrPreviewFgBg(scheme: QrColorScheme, solidBackground: boolean): { fg: string; bg: string } {
  if (scheme === "light") {
    return {
      fg: "#000000",
      bg: solidBackground ? "#ffffff" : "transparent",
    };
  }
  return {
    fg: "#ffffff",
    bg: solidBackground ? "#000000" : "transparent",
  };
}

/** Opções passadas a `QRCode.toCanvas` / `QRCode.toDataURL` (browser build). */
export function getQrCanvasRenderOptions(opts: QrExportOptions) {
  const { sizePx, scheme, solidBackground } = opts;
  const { dark, light } = buildQrModuleColors(scheme, solidBackground);
  return {
    width: sizePx,
    margin: 2,
    errorCorrectionLevel: "H" as const,
    color: { dark, light },
  };
}

/**
 * Gera PNG do QR (mesmo conteúdo do cartão) e inicia o download.
 */
export async function downloadQrCodePng(
  value: string,
  opts: QrExportOptions,
  filenameBase: string,
): Promise<void> {
  const { sizePx, scheme, solidBackground } = opts;
  const renderOpts = getQrCanvasRenderOptions({ sizePx, scheme, solidBackground });

  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, value, renderOpts);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))), "image/png");
  });

  const safe = filenameBase.replace(/[^\w-]+/g, "_").slice(0, 80) || "qrcode";
  const suffix = `${sizePx}px-${scheme === "light" ? "qr-preto" : "qr-branco"}-${solidBackground ? "com-fundo" : "sem-fundo"}`;
  const filename = `${safe}-${suffix}.png`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
