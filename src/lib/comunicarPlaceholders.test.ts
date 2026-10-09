import { describe, expect, it } from "vitest";
import {
  COMUNICAR_PH_CLIENTE,
  hidratarTextoComunicar,
  interpolarTextoComunicar,
  persistirTextoComunicar,
} from "./comunicarPlaceholders";

describe("comunicarPlaceholders", () => {
  it("troca saudação antiga pelo nome da reserva actual", () => {
    const saved = "Olá João Silva, a sua reserva está confirmada!\nDetalhes da reserva:";
    expect(hidratarTextoComunicar(saved)).toContain(COMUNICAR_PH_CLIENTE);
    expect(interpolarTextoComunicar(saved, { cliente: "Maria Souza", motorista: "Carlos" })).toBe(
      "Olá Maria Souza, a sua reserva está confirmada!\nDetalhes da reserva:",
    );
  });

  it("ao gravar, não fica o nome da reserva no molde", () => {
    const ui = "Olá Ana Costa, a sua reserva está confirmada!";
    const saved = persistirTextoComunicar(ui, { cliente: "Ana Costa", motorista: "Pedro" });
    expect(saved).toContain(COMUNICAR_PH_CLIENTE);
    expect(saved).not.toContain("Ana Costa");
  });
});
