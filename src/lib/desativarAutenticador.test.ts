import { describe, expect, it, vi } from "vitest";
import { desativarAutenticador } from "./desativarAutenticador";

const fator = { id: "fator-1", status: "verified" };

describe("desativar autenticador", () => {
  it("recusa código incompleto sem chamar a API", async () => {
    const confirmar = vi.fn();
    await expect(
      desativarAutenticador({
        codigo: "12",
        financeiroBloqueado: true,
        fatores: [fator],
        confirmar,
        liberarFinanceiro: vi.fn(),
        remover: vi.fn(),
      }),
    ).rejects.toThrow(/6 dígitos/);
    expect(confirmar).not.toHaveBeenCalled();
  });

  it("libera o financeiro antes de remover o fator", async () => {
    const ordem: string[] = [];
    await desativarAutenticador({
      codigo: "123456",
      financeiroBloqueado: true,
      fatores: [fator],
      confirmar: async () => {
        ordem.push("codigo");
      },
      liberarFinanceiro: async () => {
        ordem.push("financeiro");
      },
      remover: async () => {
        ordem.push("fator");
      },
    });
    expect(ordem).toEqual(["codigo", "financeiro", "fator"]);
  });

  it("não libera o financeiro quando o menu já está visível", async () => {
    const liberar = vi.fn();
    const remover = vi.fn();
    await desativarAutenticador({
      codigo: "123456",
      financeiroBloqueado: false,
      fatores: [fator],
      confirmar: async () => undefined,
      liberarFinanceiro: liberar,
      remover,
    });
    expect(liberar).not.toHaveBeenCalled();
    expect(remover).toHaveBeenCalledWith("fator-1");
  });

  it("mantém o fator se a liberação do financeiro falhar", async () => {
    const remover = vi.fn();
    await expect(
      desativarAutenticador({
        codigo: "123456",
        financeiroBloqueado: true,
        fatores: [fator],
        confirmar: async () => undefined,
        liberarFinanceiro: async () => {
          throw new Error("sem aal2");
        },
        remover,
      }),
    ).rejects.toThrow(/aal2/);
    expect(remover).not.toHaveBeenCalled();
  });
});
