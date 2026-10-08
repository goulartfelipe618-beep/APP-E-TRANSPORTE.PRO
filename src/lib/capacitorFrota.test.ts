import { describe, expect, it } from "vitest";
import { frotaPathFromAppUrl } from "./capacitorFrota";

describe("frotaPathFromAppUrl", () => {
  it("aceita o link público do portal", () => {
    expect(frotaPathFromAppUrl("https://e-transporte.pro/frota/acesso/abc123")).toBe(
      "/frota/acesso/abc123",
    );
    expect(frotaPathFromAppUrl("https://www.e-transporte.pro/frota")).toBe("/frota");
  });

  it("preserva query e hash", () => {
    expect(frotaPathFromAppUrl("https://e-transporte.pro/frota/acesso/tok?x=1#s")).toBe(
      "/frota/acesso/tok?x=1#s",
    );
  });

  it("aceita o esquema de teste etransporte://", () => {
    expect(frotaPathFromAppUrl("etransporte://frota/acesso/abc")).toBe("/frota/acesso/abc");
    expect(frotaPathFromAppUrl("etransporte://e-transporte.pro/frota/acesso/abc")).toBe(
      "/frota/acesso/abc",
    );
  });

  it("recusa outros hosts, esquemas e rotas do painel", () => {
    expect(frotaPathFromAppUrl("http://e-transporte.pro/frota")).toBeNull();
    expect(frotaPathFromAppUrl("https://evil.com/frota/acesso/abc")).toBeNull();
    expect(frotaPathFromAppUrl("https://e-transporte.pro.evil.com/frota")).toBeNull();
    expect(frotaPathFromAppUrl("https://e-transporte.pro/login")).toBeNull();
    expect(frotaPathFromAppUrl("https://e-transporte.pro/dashboard")).toBeNull();
    expect(frotaPathFromAppUrl("https://e-transporte.pro/frota-falso")).toBeNull();
    expect(frotaPathFromAppUrl("javascript:alert(1)")).toBeNull();
    expect(frotaPathFromAppUrl("")).toBeNull();
  });

  it("normaliza .. para não sair de /frota", () => {
    expect(frotaPathFromAppUrl("https://e-transporte.pro/frota/acesso/../../admin")).toBeNull();
  });
});
