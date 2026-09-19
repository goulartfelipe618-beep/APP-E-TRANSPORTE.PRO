import { describe, expect, it } from "vitest";
import { labelReservaStatus, normalizeReservaStatus } from "@/lib/reservaStatus";

describe("reservaStatus", () => {
  it("normaliza confirmado e concluído", () => {
    expect(normalizeReservaStatus("confirmado")).toBe("confirmada");
    expect(normalizeReservaStatus("Confirmada")).toBe("confirmada");
    expect(normalizeReservaStatus("concluído")).toBe("concluida");
    expect(normalizeReservaStatus("Concluída")).toBe("concluida");
    expect(normalizeReservaStatus("em andamento")).toBe("em_andamento");
    expect(normalizeReservaStatus("em_andamento")).toBe("em_andamento");
  });

  it("rótulo da agenda e do portal", () => {
    expect(labelReservaStatus("confirmado")).toBe("Confirmada");
    expect(labelReservaStatus("pendente")).toBe("Pendente");
  });
});
