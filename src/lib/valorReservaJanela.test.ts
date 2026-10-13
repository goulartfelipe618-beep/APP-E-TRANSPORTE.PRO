import { describe, expect, it } from "vitest";
import { diaNaJanelaOperacional, deslocarDia, hojeSaoPaulo, mostrarValorReserva, redigirValoresTexto } from "./valorReservaJanela";

describe("janela de valor da reserva", () => {
  const agora = new Date("2026-10-13T15:00:00-03:00");

  it("considera ontem, hoje e amanhã em São Paulo", () => {
    expect(hojeSaoPaulo(agora)).toBe("2026-10-13");
    expect(diaNaJanelaOperacional("2026-10-12", agora)).toBe(true);
    expect(diaNaJanelaOperacional("2026-10-13", agora)).toBe(true);
    expect(diaNaJanelaOperacional("2026-10-14", agora)).toBe(true);
    expect(diaNaJanelaOperacional("2026-10-16", agora)).toBe(false);
    expect(deslocarDia("2026-10-01", -1)).toBe("2026-09-30");
  });

  it("mostra qualquer valor quando o financeiro não está bloqueado", () => {
    expect(mostrarValorReserva(false, ["2026-10-16"], agora)).toBe(true);
  });

  it("esconde a reserva fora da janela e mostra se ida ou volta cair nela", () => {
    expect(mostrarValorReserva(true, ["2026-10-16"], agora)).toBe(false);
    expect(mostrarValorReserva(true, ["2026-09-01", "2026-10-14"], agora)).toBe(true);
    expect(mostrarValorReserva(true, [null], agora)).toBe(false);
  });

  it("tira o preço do texto da mensagem e deixa o restante", () => {
    expect(redigirValoresTexto("Cobrar 300,00 reais")).toBe("Cobrar —");
    expect(redigirValoresTexto("Valor R$ 1.250,80")).toBe("Valor —");
    expect(redigirValoresTexto("4 Pax")).toBe("4 Pax");
  });
});
