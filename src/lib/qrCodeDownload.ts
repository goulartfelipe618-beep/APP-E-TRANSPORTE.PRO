import QRCode from "qrcode";

/** Tamanhos de exportação (px). */
export const QR_EXPORT_SIZES = {
  pequeno: 512,
  medio: 1024,
  grande: 2048,
} as const;

export type QrExportSizeId = keyof typeof QR_EXPORT_SIZES;

/** Esquema: claro = QR preto; escuro = QR branco (fundo oposto ou transparente). */
export type QrColorScheme = "light" | "dark";

export interface QrExportOptions {
  sizePx: number;
  scheme: QrColorScheme;
  /** true = fundo branco ou preto sólido; false = fundo transparente (PNG). */
  solidBackground: boolean;
}

function buildColors(scheme: QrColorScheme, solidBackground: boolean): { dark: string; light: string } {
  if (scheme === "light") {
    return {
      dark: "#000000ff",
      light: solidBackground ? "#ffffffff" : "#00000000",
    };
  }
  return {
    dark: "#ffffffff",
    light: solidBackground ? "#000000ff" : "#00000000",
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
  const { dark, light } = buildColors(scheme, solidBackground);

  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, value, {
    width: sizePx,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark, light },
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))), "image/png");
  });

  const safe = filenameBase.replace(/[^\w\-]+/g, "_").slice(0, 80) || "qrcode";
  const suffix = `${sizePx}px-${scheme === "light" ? "qr-preto" : "qr-branco"}-${solidBackground ? "com-fundo" : "sem-fundo"}`;
  const filename = `${safe}-${suffix}.png`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
