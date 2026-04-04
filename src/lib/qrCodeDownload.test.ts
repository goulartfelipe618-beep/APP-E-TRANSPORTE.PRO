import { describe, it, expect } from "vitest";
import {
  buildQrModuleColors,
  getQrCanvasRenderOptions,
  getQrPreviewFgBg,
  QR_EXPORT_SIZES,
} from "./qrCodeDownload";

describe("qrCodeDownload", () => {
  it("light + fundo sólido: módulos escuros em fundo claro (lib qrcode: dark=preto, light=branco)", () => {
    expect(buildQrModuleColors("light", true)).toEqual({
      dark: "#000000",
      light: "#ffffff",
    });
    expect(getQrPreviewFgBg("light", true)).toEqual({ fg: "#000000", bg: "#ffffff" });
  });

  it("dark + fundo sólido: módulos claros em fundo escuro (invertido)", () => {
    expect(buildQrModuleColors("dark", true)).toEqual({
      dark: "#ffffff",
      light: "#000000",
    });
    expect(getQrPreviewFgBg("dark", true)).toEqual({ fg: "#ffffff", bg: "#000000" });
  });

  it("transparente: light modules com alpha zero", () => {
    expect(buildQrModuleColors("light", false).light).toBe("#00000000");
    expect(buildQrModuleColors("dark", false).light).toBe("#00000000");
  });

  it("getQrCanvasRenderOptions repassa width e cores para o renderizador", () => {
    const o1024 = getQrCanvasRenderOptions({ sizePx: 1024, scheme: "light", solidBackground: true });
    expect(o1024.width).toBe(1024);
    expect(o1024.margin).toBe(2);
    expect(o1024.errorCorrectionLevel).toBe("H");
    expect(o1024.color).toEqual({ dark: "#000000", light: "#ffffff" });

    const o2048dark = getQrCanvasRenderOptions({ sizePx: 2048, scheme: "dark", solidBackground: true });
    expect(o2048dark.width).toBe(2048);
    expect(o2048dark.color).toEqual({ dark: "#ffffff", light: "#000000" });
  });

  it("tamanhos exportação", () => {
    expect(QR_EXPORT_SIZES.pequeno).toBe(512);
    expect(QR_EXPORT_SIZES.medio).toBe(1024);
    expect(QR_EXPORT_SIZES.grande).toBe(2048);
  });
});
