import { describe, expect, it } from "vitest";
import { organizarTextoReserva, splitTextoComLinks } from "@/lib/textoComLinks";

describe("splitTextoComLinks", () => {
  it("separa um endereço http no meio do texto", () => {
    const parts = splitTextoComLinks("Desembarque em: https://driver.mozio.com/abc. MAICCO");
    expect(parts).toEqual([
      { type: "text", value: "Desembarque em: " },
      { type: "link", value: "https://driver.mozio.com/abc" },
      { type: "text", value: "." },
      { type: "text", value: " MAICCO" },
    ]);
  });

  it("mantém texto sem link", () => {
    expect(splitTextoComLinks("sem endereço")).toEqual([{ type: "text", value: "sem endereço" }]);
  });
});

describe("organizarTextoReserva", () => {
  it("separa trechos unidos por barra e rótulos", () => {
    expect(organizarTextoReserva("Nome: Ana | Telefone: 11  Em: quinta")).toBe(
      "Nome: Ana\nTelefone: 11\nEm: quinta",
    );
  });

  it("preserva a quebra digitada no formulário", () => {
    expect(organizarTextoReserva("primeira linha\nsegunda linha")).toBe("primeira linha\nsegunda linha");
  });
});
