import { describe, expect, it } from "vitest";
import { primeiroSegmentoEndereco } from "./abrangenciaMapHelpers";

describe("primeiroSegmentoEndereco", () => {
  it("retorna primeira linha quando há várias", () => {
    expect(primeiroSegmentoEndereco("Rua A, 1\nRua B, 2")).toBe("Rua A, 1");
  });
  it("retorna primeiro trecho separado por ponto e vírgula", () => {
    expect(primeiroSegmentoEndereco("Ponto A; Ponto B")).toBe("Ponto A");
  });
  it("retorna primeiro trecho separado por pipe", () => {
    expect(primeiroSegmentoEndereco("Local 1 | Local 2")).toBe("Local 1");
  });
  it("endereço único sem separadores permanece inteiro", () => {
    expect(primeiroSegmentoEndereco("Av. Paulista, 1000, São Paulo")).toBe("Av. Paulista, 1000, São Paulo");
  });
});
