import { describe, expect, it } from "vitest";
import {
  dividirVinculosNasDuasPernas,
  montarVinculosExtrasParaGravar,
  parseRepasseInformado,
  repasseVisivelNoPortal,
  resolverMotoristasExtras,
  resolverVinculosExtras,
} from "@/lib/reservaMotoristasExtra";

const admin = "admin-1";
const outro = "admin-2";

const frota = [
  { id: "ficha-a", portal_auth_user_id: "portal-a", user_id: admin },
  { id: "ficha-b", portal_auth_user_id: "portal-b", user_id: admin },
  { id: "ficha-c", portal_auth_user_id: null, user_id: admin },
  { id: "ficha-x", portal_auth_user_id: "portal-x", user_id: outro },
];

describe("resolverMotoristasExtras", () => {
  it("grava o id da ficha de cada motorista extra desta conta", () => {
    const { ids, recusados } = resolverMotoristasExtras({
      selecionados: ["portal-b", "ficha-c"],
      primaryId: "portal-a",
      motoristas: frota,
      userId: admin,
    });
    expect(ids).toEqual(["ficha-b", "ficha-c"]);
    expect(recusados).toEqual([]);
  });

  it("não repete o motorista principal nem aceita motorista de outro administrador", () => {
    const { ids, recusados } = resolverMotoristasExtras({
      selecionados: ["portal-a", "ficha-x", "portal-x"],
      primaryId: "ficha-a",
      motoristas: frota,
      userId: admin,
    });
    expect(ids).toEqual([]);
    expect(recusados).toEqual(["ficha-x", "portal-x"]);
  });
});

describe("repasse dos motoristas extras", () => {
  it("guarda o valor de cada ficha e recusa motorista de outra conta", () => {
    const { vinculos, recusados } = resolverVinculosExtras({
      vinculos: [
        { motoristaId: "portal-b", repasse: 80 },
        { motoristaId: "ficha-c", repasse: null },
        { motoristaId: "ficha-x", repasse: 50 },
      ],
      primaryId: "portal-a",
      motoristas: frota,
      userId: admin,
    });
    expect(vinculos).toEqual([
      { motoristaId: "ficha-b", repasse: 80 },
      { motoristaId: "ficha-c", repasse: null },
    ]);
    expect(recusados).toEqual(["ficha-x"]);
  });

  it("não aceita repasse negativo e trata vazio como sem valor", () => {
    expect(parseRepasseInformado("")).toEqual({ ok: true, valor: null });
    expect(parseRepasseInformado("80,5")).toEqual({ ok: true, valor: 80.5 });
    expect(parseRepasseInformado("-1").ok).toBe(false);
    expect(montarVinculosExtrasParaGravar([{ motoristaId: "ficha-b", repasse: "abc" }]).ok).toBe(false);
  });

  it("divide o repasse entre ida e volta sem perder centavo", () => {
    const partes = dividirVinculosNasDuasPernas([{ motoristaId: "ficha-b", repasse: 80.01 }]);
    const centavos = (valor: number | null) => Math.round((valor ?? 0) * 100);
    expect(centavos(partes.ida[0].repasse) + centavos(partes.volta[0].repasse)).toBe(8001);
  });

  it("o extra vê só o próprio repasse", () => {
    expect(
      repasseVisivelNoPortal({ acesso: "extra", repassePrincipal: 200, repasseDesteMotorista: 80 }),
    ).toBe(80);
    expect(
      repasseVisivelNoPortal({ acesso: "extra", repassePrincipal: 200, repasseDesteMotorista: null }),
    ).toBeNull();
    expect(
      repasseVisivelNoPortal({ acesso: "principal", repassePrincipal: 200, repasseDesteMotorista: 80 }),
    ).toBe(200);
  });
});
