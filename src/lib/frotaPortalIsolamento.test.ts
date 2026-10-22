import { describe, expect, it } from "vitest";
import { reservaEntraNaAgendaDoPortal, reservaVisivelNoPortal, unirReservasPorId, type FichaPortalMotorista } from "./frotaPortalIsolamento";

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

  it("o segundo motorista vê a reserva vinculada, mesmo sem ser o motorista principal", () => {
    const extras = new Set(["reserva-2"]);
    expect(
      reservaEntraNaAgendaDoPortal(
        { id: "reserva-2", motorista_id: "login-principal", owner_user_id: "admin-a", acesso: "principal" },
        [joaoDaEmpresaA],
        extras,
      ),
    ).toBe(true);
    expect(
      reservaEntraNaAgendaDoPortal(
        { id: "reserva-2", motorista_id: "login-principal", owner_user_id: "admin-b" },
        [joaoDaEmpresaA],
        extras,
      ),
    ).toBe(false);
    expect(
      reservaEntraNaAgendaDoPortal(
        { id: "reserva-1", motorista_id: "card-maria", owner_user_id: "admin-a", acesso: "principal" },
        [joaoDaEmpresaA],
        extras,
      ),
    ).toBe(false);
  });

  it("não troca a reserva que o motorista principal já via", () => {
    const juntas = unirReservasPorId(
      [{ id: "r1", repasse: 100 }],
      [
        { id: "r1", repasse: 40 },
        { id: "r2", repasse: 50 },
      ],
    );
    expect(juntas).toEqual([
      { id: "r1", repasse: 100 },
      { id: "r2", repasse: 50 },
    ]);
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
