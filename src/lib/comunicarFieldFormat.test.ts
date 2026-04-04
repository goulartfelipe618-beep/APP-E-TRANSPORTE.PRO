import { describe, expect, it } from "vitest";
import {
  dadosRegistroComunicarParaWebhook,
  formatComunicarValorCampo,
  formatQuemViajaParaComunicar,
  formatTipoViagemParaComunicar,
} from "./comunicarFieldFormat";

describe("comunicarFieldFormat", () => {
  it("tipo de viagem: enums → rótulos sem underscore", () => {
    expect(formatTipoViagemParaComunicar("somente_ida")).toBe("Somente Ida");
    expect(formatTipoViagemParaComunicar("ida_volta")).toBe("Ida e Volta");
    expect(formatTipoViagemParaComunicar("por_hora")).toBe("Por Hora");
  });

  it("quem viaja: motorista e eu_mesmo", () => {
    expect(formatQuemViajaParaComunicar("motorista")).toBe("Motorista");
    expect(formatQuemViajaParaComunicar("eu_mesmo")).toBe("Eu mesmo");
  });

  it("formatComunicarValorCampo por chave", () => {
    expect(formatComunicarValorCampo("tipo_viagem", "ida_volta")).toBe("Ida e Volta");
    expect(formatComunicarValorCampo("tipo", "por_hora")).toBe("Por Hora");
    expect(formatComunicarValorCampo("quem_viaja", "motorista")).toBe("Motorista");
    expect(formatComunicarValorCampo("nome_completo", "João")).toBe("João");
  });

  it("dadosRegistroComunicarParaWebhook substitui campos no clone", () => {
    const out = dadosRegistroComunicarParaWebhook({
      nome_completo: "Teste",
      tipo_viagem: "somente_ida",
      quem_viaja: "eu_mesmo",
    });
    expect(out.tipo_viagem).toBe("Somente Ida");
    expect(out.quem_viaja).toBe("Eu mesmo");
    expect(out.nome_completo).toBe("Teste");
  });
});
