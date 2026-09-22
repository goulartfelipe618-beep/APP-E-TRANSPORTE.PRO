import { describe, expect, it } from "vitest";
import { buildAgendaItemsPorDia } from "@/lib/painelAgendaReservas";
import {
  formatTransferTipoViagemExibicao,
  isTransferPernaDividida,
  resolveMotoristaIdsPorPerna,
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

  it("formata 2 ou mais trajetos", () => {
    expect(formatTransferTipoViagemExibicao("multiplos_trajetos")).toBe("2 ou mais trajetos");
  });

  it("atribui motorista só na perna escolhida", () => {
    expect(resolveMotoristaIdsPorPerna("m1", "ida")).toEqual({ ida: "m1", volta: null });
    expect(resolveMotoristaIdsPorPerna("m1", "volta")).toEqual({ ida: null, volta: "m1" });
    expect(resolveMotoristaIdsPorPerna("m1", "ambas")).toEqual({ ida: "m1", volta: "m1" });
    expect(resolveMotoristaIdsPorPerna(null, "ambas")).toEqual({ ida: null, volta: null });
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

  it("mostra sigla da categoria na agenda", () => {
    const map = buildAgendaItemsPorDia(
      [
        {
          id: "c",
          tipo_viagem: "somente_ida",
          numero_reserva: 12,
          status: "pendente",
          ida_data: "2026-09-17",
          ida_hora: "09:00",
          volta_data: null,
          volta_hora: null,
          por_hora_data: null,
          por_hora_hora: null,
          ida_embarque: "A",
          ida_desembarque: "B",
          volta_embarque: null,
          volta_desembarque: null,
          por_hora_endereco_inicio: null,
          por_hora_ponto_encerramento: null,
          motorista_id: null,
          categoria_veiculo: "veiculo_07_lugares",
        },
      ],
      [],
    );
    expect(map.get("2026-09-17")?.[0]?.categoriaAbrev).toBe("07LUG.");
  });

  it("agenda um item por parada em 2+ trajetos", () => {
    const map = buildAgendaItemsPorDia(
      [
        {
          id: "m",
          tipo_viagem: "multiplos_trajetos",
          numero_reserva: 88,
          status: "pendente",
          ida_data: "2026-09-22",
          ida_hora: "08:00",
          volta_data: null,
          volta_hora: null,
          por_hora_data: null,
          por_hora_hora: null,
          ida_embarque: "A",
          ida_desembarque: "C",
          volta_embarque: null,
          volta_desembarque: null,
          por_hora_endereco_inicio: null,
          por_hora_ponto_encerramento: null,
          motorista_id: null,
          trajetos: [
            { embarque: "A", desembarque: "B", data: "2026-09-22", hora: "08:00", passageiros: 2 },
            { embarque: "B", desembarque: "C", data: "2026-09-23", hora: "10:00", passageiros: 2 },
          ],
        },
      ],
      [],
    );
    expect(map.get("2026-09-22")?.[0]?.perna).toBe("Trecho 1");
    expect(map.get("2026-09-23")?.[0]?.perna).toBe("Trecho 2");
  });
});
