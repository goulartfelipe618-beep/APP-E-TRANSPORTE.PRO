import { describe, expect, it } from "vitest";
import { emailEhContaDeMotoristaPortal, lerTokenDaEntrada } from "@/lib/motoristaPortalEntrada";

describe("emailEhContaDeMotoristaPortal", () => {
  it("reconhece o e-mail do mini painel e deixa passar o da empresa", () => {
    expect(emailEhContaDeMotoristaPortal("frota.465613b5f42eaeec56432abf407bda@motorista-frota.local")).toBe(true);
    expect(emailEhContaDeMotoristaPortal("  Frota.ABC@Motorista-Frota.Local ")).toBe(true);
    expect(emailEhContaDeMotoristaPortal("comercial@empresa.com")).toBe(false);
  });
});

describe("lerTokenDaEntrada", () => {
  it("aceita só o token gravado para este motorista", () => {
    const raw = JSON.stringify({ userId: "motorista-1", token: "link-unico" });
    expect(lerTokenDaEntrada(raw, "motorista-1")).toBe("link-unico");
  });

  it("recusa token de outro motorista, vazio ou texto inválido", () => {
    expect(lerTokenDaEntrada(JSON.stringify({ userId: "outro", token: "link-unico" }), "motorista-1")).toBeNull();
    expect(lerTokenDaEntrada(JSON.stringify({ userId: "motorista-1", token: "  " }), "motorista-1")).toBeNull();
    expect(lerTokenDaEntrada("nao-json", "motorista-1")).toBeNull();
    expect(lerTokenDaEntrada(null, "motorista-1")).toBeNull();
  });
});
