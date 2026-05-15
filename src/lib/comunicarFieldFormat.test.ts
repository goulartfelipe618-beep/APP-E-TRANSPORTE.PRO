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

  it("dadosRegistroComunicarParaWebhook remove chaves confidenciais do payload", () => {
    const out = dadosRegistroComunicarParaWebhook({
      nome_completo: "Cliente",
      status: "pendente",
      numero_reserva: 1041,
      repasse_motorista: 60,
      cadastro_cliente_id: "64294a6c-23ec-42d0-8ed0-927ae174d8ae",
      perna_viagem: "volta",
      par_reserva_id: "756c1233-3063-4067-91ef-3ec5932e0ea2",
    });
    expect(out.nome_completo).toBe("Cliente");
    expect(out.status).toBeUndefined();
    expect(out.numero_reserva).toBeUndefined();
    expect(out.repasse_motorista).toBeUndefined();
    expect(out.cadastro_cliente_id).toBeUndefined();
    expect(out.perna_viagem).toBeUndefined();
    expect(out.par_reserva_id).toBeUndefined();
  });
});
