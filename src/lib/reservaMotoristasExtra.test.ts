import { describe, expect, it } from "vitest";
import { resolverMotoristasExtras } from "@/lib/reservaMotoristasExtra";

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
