import { describe, expect, it } from "vitest";
import {
  motoristaAssignValue,
  motoristaMatchesAssignment,
  resolveMotoristaNome,
} from "@/lib/motoristaReservaAssign";

describe("motoristaReservaAssign", () => {
  const comPortal = { id: "sol-1", nome: "Ana", portal_auth_user_id: "auth-1" };
  const semPortal = { id: "sol-2", nome: "Bruno", portal_auth_user_id: null };

  it("prefere o uid do portal quando existe", () => {
    expect(motoristaAssignValue(comPortal)).toBe("auth-1");
    expect(motoristaAssignValue(semPortal)).toBe("sol-2");
  });

  it("reconhece atribuição por uid do portal ou id do cadastro", () => {
    expect(motoristaMatchesAssignment("auth-1", comPortal)).toBe(true);
    expect(motoristaMatchesAssignment("sol-1", comPortal)).toBe(true);
    expect(motoristaMatchesAssignment("sol-2", semPortal)).toBe(true);
    expect(motoristaMatchesAssignment("auth-1", semPortal)).toBe(false);
  });

  it("resolve o nome na lista de reservas", () => {
    expect(resolveMotoristaNome("auth-1", [comPortal, semPortal])).toBe("Ana");
    expect(resolveMotoristaNome("sol-2", [comPortal, semPortal])).toBe("Bruno");
    expect(resolveMotoristaNome(null, [comPortal])).toBe("—");
  });
});
