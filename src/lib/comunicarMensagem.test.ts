import { describe, expect, it } from "vitest";
import { montarMensagemComunicar } from "./comunicarMensagem";
import { limparLinhasDeCampoComunicar, persistirTextoComunicar } from "./comunicarPlaceholders";

const labels = {
  nome_completo: "Nome Completo",
  ida_embarque: "Embarque (Ida)",
  ida_data: "Data (Ida)",
};
const ignored = ["id", "user_id"];

describe("montarMensagemComunicar", () => {
  it("não reaproveita campos da reserva anterior", () => {
    const primeira = montarMensagemComunicar({
      dados: {
        id: "reserva-1",
        nome_completo: "MZ",
        ida_embarque: "FLN - Aeroporto Hercilio Luz",
        ida_data: "2027-01-31",
      },
      acima: "Olá {{nome_cliente}}, a sua reserva está confirmada!",
      abaixo: "",
      vars: ["nome_completo", "ida_embarque", "ida_data"],
      nomes: { cliente: "MZ", motorista: "Motorista" },
      labels,
      ignoredKeys: ignored,
    });
    const segunda = montarMensagemComunicar({
      dados: {
        id: "reserva-2",
        nome_completo: "Ana Costa",
        ida_embarque: "GRU - Guarulhos",
        ida_data: "2027-03-02",
      },
      acima: "Olá {{nome_cliente}}, a sua reserva está confirmada!",
      abaixo: "",
      vars: ["nome_completo", "ida_embarque", "ida_data"],
      nomes: { cliente: "Ana Costa", motorista: "Motorista" },
      labels,
      ignoredKeys: ignored,
    });

    expect(primeira).toContain("FLN - Aeroporto Hercilio Luz");
    expect(primeira).toContain("2027-01-31");
    expect(segunda).toContain("Ana Costa");
    expect(segunda).toContain("GRU - Guarulhos");
    expect(segunda).toContain("2027-03-02");
    expect(segunda).not.toContain("MZ");
    expect(segunda).not.toContain("FLN");
    expect(segunda).not.toContain("2027-01-31");
  });

  it("texto gravado do comunicado anterior não entra no envio desta reserva", () => {
    const acimaDoAnterior = [
      "Olá MZ, a sua reserva está confirmada!",
      "Detalhes da reserva:",
      "*Embarque (Ida):* FLN - Aeroporto Hercilio Luz",
      "Data (Ida): 2027-01-31",
    ].join("\n");
    const msg = montarMensagemComunicar({
      dados: {
        id: "reserva-2",
        nome_completo: "Ana Costa",
        ida_embarque: "GRU - Guarulhos",
        ida_data: "2027-03-02",
      },
      acima: acimaDoAnterior,
      abaixo: "*Valor:* R$ 290,00\nEm breve o motorista entrará em contato!",
      vars: ["nome_completo", "ida_embarque", "ida_data"],
      nomes: { cliente: "Ana Costa", motorista: "Carlos" },
      labels,
      ignoredKeys: ignored,
    });

    expect(msg).toContain("Olá Ana Costa, a sua reserva está confirmada!");
    expect(msg).toContain("*Embarque (Ida):* GRU - Guarulhos");
    expect(msg).toContain("*Data (Ida):* 2027-03-02");
    expect(msg).toContain("Em breve o motorista entrará em contato!");
    expect(msg).not.toContain("MZ");
    expect(msg).not.toContain("FLN");
    expect(msg).not.toContain("2027-01-31");
    expect(msg).not.toContain("R$ 290,00");
  });

  it("o molde gravado não carrega os valores da reserva", () => {
    const sujo = [
      "Olá MZ, a sua reserva está confirmada!",
      "",
      "*Embarque (Ida):* FLN - Aeroporto Hercilio Luz",
      "*Data (Ida):* 2027-01-31",
    ].join("\n");
    const limpo = persistirTextoComunicar(sujo, { cliente: "MZ", motorista: "Motorista" });
    expect(limparLinhasDeCampoComunicar(sujo)).not.toContain("FLN");
    expect(limpo).not.toContain("FLN");
    expect(limpo).not.toContain("MZ");
    expect(limpo).toContain("{{nome_cliente}}");
  });
});
