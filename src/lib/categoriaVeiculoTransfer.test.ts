import { describe, expect, it } from "vitest";
import {
  abrevCategoriaVeiculoTransfer,
  isCategoriaVeiculoTransfer,
  labelCategoriaVeiculoTransfer,
} from "@/lib/categoriaVeiculoTransfer";

describe("categoriaVeiculoTransfer", () => {
  it("aceita só as categorias oficiais", () => {
    expect(isCategoriaVeiculoTransfer("van")).toBe(true);
    expect(isCategoriaVeiculoTransfer("micro_onibus")).toBe(true);
    expect(isCategoriaVeiculoTransfer("veiculo_07_lugares")).toBe(true);
    expect(isCategoriaVeiculoTransfer("carro")).toBe(false);
    expect(isCategoriaVeiculoTransfer("")).toBe(false);
  });

  it("abreviacões da agenda", () => {
    expect(abrevCategoriaVeiculoTransfer("van")).toBe("VAN");
    expect(abrevCategoriaVeiculoTransfer("micro_onibus")).toBe("MIC.");
    expect(abrevCategoriaVeiculoTransfer("veiculo_07_lugares")).toBe("07LUG.");
    expect(abrevCategoriaVeiculoTransfer("mini_van")).toBe("MINIVAN");
    expect(abrevCategoriaVeiculoTransfer("sedan")).toBe("SED");
    expect(abrevCategoriaVeiculoTransfer("hatch")).toBe("HAT");
    expect(abrevCategoriaVeiculoTransfer("onibus")).toBe("ONIBUS");
    expect(abrevCategoriaVeiculoTransfer(null)).toBeNull();
  });

  it("rótulo completo", () => {
    expect(labelCategoriaVeiculoTransfer("veiculo_07_lugares")).toBe("VEÍCULOS 07 LUGARES");
  });
});
