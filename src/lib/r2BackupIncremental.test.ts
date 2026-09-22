import { describe, expect, it } from "vitest";
import {
  chunkRows,
  filterRowsSinceCursor,
  incrementFileName,
  nextBackupCursor,
  rowBackupStamp,
} from "@/lib/r2BackupIncremental";

describe("r2BackupIncremental", () => {
  const clientes = [
    { id: "1", nome: "Ana", created_at: "2026-09-01T10:00:00.000Z", updated_at: "2026-09-01T10:00:00.000Z" },
    { id: "2", nome: "Bruno", created_at: "2026-09-20T03:00:00.000Z", updated_at: "2026-09-20T03:00:00.000Z" },
    { id: "3", nome: "Carla", created_at: "2026-09-22T16:00:00.000Z", updated_at: "2026-09-22T16:00:00.000Z" },
  ];

  it("na primeira cópia devolve todas as linhas", () => {
    expect(filterRowsSinceCursor(clientes, null)).toHaveLength(3);
  });

  it("depois da primeira cópia só devolve o cliente novo", () => {
    const changed = filterRowsSinceCursor(clientes, "2026-09-20T03:18:15.000Z");
    expect(changed).toHaveLength(1);
    expect(changed[0]?.id).toBe("3");
  });

  it("inclui cliente antigo que foi editado", () => {
    const rows = [
      ...clientes,
      { id: "1b", nome: "Ana 2", created_at: "2026-09-01T10:00:00.000Z", updated_at: "2026-09-22T17:00:00.000Z" },
    ];
    const changed = filterRowsSinceCursor(rows, "2026-09-20T03:18:15.000Z");
    expect(changed.map((r) => r.id).sort()).toEqual(["1b", "3"]);
  });

  it("não reenvia nada se nada mudou", () => {
    expect(filterRowsSinceCursor(clientes.slice(0, 2), "2026-09-20T03:18:15.000Z")).toEqual([]);
  });

  it("avança o cursor só quando há linha mais nova", () => {
    expect(nextBackupCursor("2026-09-20T03:18:15.000Z", clientes)).toBe("2026-09-22T16:00:00.000Z");
    expect(nextBackupCursor("2026-09-23T00:00:00.000Z", clientes)).toBe("2026-09-23T00:00:00.000Z");
  });

  it("usa o maior entre created_at e updated_at", () => {
    expect(
      rowBackupStamp({
        created_at: "2026-09-01T00:00:00.000Z",
        updated_at: "2026-09-10T00:00:00.000Z",
      }),
    ).toBe("2026-09-10T00:00:00.000Z");
  });

  it("nomeia o ficheiro de incremento por dataset", () => {
    expect(incrementFileName("CLIENTES/CLIENTES.csv", "2026-09-22T16-00-00")).toBe(
      "CLIENTES/CLIENTES/incrementos/2026-09-22T16-00-00.csv",
    );
  });

  it("parte listas grandes sem perder linhas", () => {
    const parts = chunkRows([1, 2, 3, 4, 5], 2);
    expect(parts).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkRows([], 2)).toEqual([]);
  });
});
