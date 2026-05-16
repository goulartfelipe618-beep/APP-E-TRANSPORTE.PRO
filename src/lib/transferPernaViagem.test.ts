import { describe, expect, it } from "vitest";
import { buildAgendaItemsPorDia } from "@/lib/painelAgendaReservas";
import {
  formatTransferTipoViagemExibicao,
  isTransferPernaDividida,
  transferSecaoTrajetoTitulo,
} from "@/lib/transferPernaViagem";

describe("transferPernaViagem", () => {
  it("identifica linha dividida ida/volta", () => {
    expect(isTransferPernaDividida("somente_ida", "ida")).toBe(true);
    expect(isTransferPernaDividida("somente_ida", "volta")).toBe(true);
    expect(isTransferPernaDividida("ida_volta", null)).toBe(false);
  });

  it("formata tipo para exibição", () => {
    expect(formatTransferTipoViagemExibicao("somente_ida", "volta")).toBe("Ida e Volta · Volta");
    expect(formatTransferTipoViagemExibicao("somente_ida", "ida")).toBe("Ida e Volta · Ida");
    expect(formatTransferTipoViagemExibicao("somente_ida", null)).toBe("Somente Ida");
  });

  it("título da secção volta na linha dividida", () => {
    expect(transferSecaoTrajetoTitulo("somente_ida", "volta")).toBe("⇆ Volta");
    expect(transferSecaoTrajetoTitulo("somente_ida", "ida")).toBe("→ Ida");
  });
});

describe("buildAgendaItemsPorDia — perna dividida", () => {
  it("marca Ida e Volta em dias distintos", () => {
    const map = buildAgendaItemsPorDia(
      [
        {
          id: "a",
          tipo_viagem: "somente_ida",
          perna_viagem: "ida",
          numero_reserva: 1040,
          status: "pendente",
          ida_data: "2026-05-17",
          ida_hora: "15:00",
          volta_data: null,
          volta_hora: null,
          por_hora_data: null,
          por_hora_hora: null,
          ida_embarque: "Hotel",
          ida_desembarque: "Casa",
          volta_embarque: null,
          volta_desembarque: null,
          por_hora_endereco_inicio: null,
          por_hora_ponto_encerramento: null,
          motorista_id: null,
        },
        {
          id: "b",
          tipo_viagem: "somente_ida",
          perna_viagem: "volta",
          numero_reserva: 1041,
          status: "pendente",
          ida_data: "2026-05-18",
          ida_hora: "12:00",
          volta_data: null,
          volta_hora: null,
          por_hora_data: null,
          por_hora_hora: null,
          ida_embarque: "Casa",
          ida_desembarque: "Hotel",
          volta_embarque: null,
          volta_desembarque: null,
          por_hora_endereco_inicio: null,
          por_hora_ponto_encerramento: null,
          motorista_id: null,
        },
      ],
      [],
    );

    expect(map.get("2026-05-17")?.[0]?.perna).toBe("Ida");
    expect(map.get("2026-05-18")?.[0]?.perna).toBe("Volta");
  });
});
