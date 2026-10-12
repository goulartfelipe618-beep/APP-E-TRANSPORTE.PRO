import { describe, expect, it } from "vitest";
import { reservaVisivelNoPortal, type FichaPortalMotorista } from "./frotaPortalIsolamento";

const joaoDaEmpresaA: FichaPortalMotorista = {
  id: "card-joao",
  userId: "admin-a",
  portalAuthUserId: "login-joao",
};

describe("reservaVisivelNoPortal", () => {
  it("mostra a reserva atribuída a este motorista", () => {
    expect(
      reservaVisivelNoPortal(
        { motorista_id: "login-joao", owner_user_id: "admin-a", acesso: "principal" },
        [joaoDaEmpresaA],
      ),
    ).toBe(true);
  });

  it("não mostra reserva de outro motorista da mesma empresa", () => {
    expect(
      reservaVisivelNoPortal(
        { motorista_id: "card-maria", owner_user_id: "admin-a", acesso: "principal" },
        [joaoDaEmpresaA],
      ),
    ).toBe(false);
  });

  it("não mostra reserva de motorista cadastrado por outro administrador", () => {
    expect(
      reservaVisivelNoPortal(
        { motorista_id: "login-joao", owner_user_id: "admin-b", acesso: "principal" },
        [joaoDaEmpresaA],
      ),
    ).toBe(false);
  });

  it("sem ficha deste login, não mostra nada", () => {
    expect(
      reservaVisivelNoPortal(
        { motorista_id: "login-joao", owner_user_id: "admin-a", acesso: "principal" },
        [],
      ),
    ).toBe(false);
  });

  it("extra só entra se a conta do administrador for a desta ficha", () => {
    expect(
      reservaVisivelNoPortal(
        { motorista_id: "card-outro", owner_user_id: "admin-a", acesso: "extra" },
        [joaoDaEmpresaA],
      ),
    ).toBe(true);
    expect(
      reservaVisivelNoPortal(
        { motorista_id: "card-outro", owner_user_id: "admin-b", acesso: "extra" },
        [joaoDaEmpresaA],
      ),
    ).toBe(false);
  });
});
