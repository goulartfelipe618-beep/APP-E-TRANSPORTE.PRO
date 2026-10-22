import { describe, expect, it } from "vitest";
import {
  emailEhContaDeMotoristaPortal,
  lerPreviewDoDono,
  lerTokenDaEntrada,
  loginDoMotoristaTrocaraOutraConta,
  saidaDoMiniPainelEhLocal,
  sessaoPodeAbrirMiniPainelDoDono,
} from "@/lib/motoristaPortalEntrada";

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

describe("mini painel na guia do admin", () => {
  it("deixa o dono e o admin master abrirem, e recusa outra conta", () => {
    expect(sessaoPodeAbrirMiniPainelDoDono({ sessionUserId: "admin-1", fichaUserId: "admin-1", papel: "cliente" })).toBe(true);
    expect(sessaoPodeAbrirMiniPainelDoDono({ sessionUserId: "mestre", fichaUserId: "admin-1", papel: "admin_master" })).toBe(true);
    expect(sessaoPodeAbrirMiniPainelDoDono({ sessionUserId: "outro", fichaUserId: "admin-1", papel: "cliente" })).toBe(false);
  });

  it("sair do mini painel fica neste navegador e o painel da empresa continua global", () => {
    expect(saidaDoMiniPainelEhLocal("/frota")).toBe(true);
    expect(saidaDoMiniPainelEhLocal("/frota/acesso/abc")).toBe(true);
    expect(saidaDoMiniPainelEhLocal("/dashboard")).toBe(false);
    expect(saidaDoMiniPainelEhLocal("/login")).toBe(false);
  });

  it("não troca a sessão quando o e-mail já aberto é outro", () => {
    expect(loginDoMotoristaTrocaraOutraConta("admin@empresa.com", "frota.abc@motorista-frota.local")).toBe(true);
    expect(loginDoMotoristaTrocaraOutraConta("frota.abc@motorista-frota.local", "frota.abc@motorista-frota.local")).toBe(false);
    expect(loginDoMotoristaTrocaraOutraConta(null, "frota.abc@motorista-frota.local")).toBe(false);
  });

  it("lê só um preview completo", () => {
    expect(
      lerPreviewDoDono(JSON.stringify({ ownerId: "admin-1", token: "link", fichaId: "ficha-1", nome: "Ana" }))?.fichaId,
    ).toBe("ficha-1");
    expect(lerPreviewDoDono(JSON.stringify({ ownerId: "admin-1" }))).toBeNull();
  });
});
