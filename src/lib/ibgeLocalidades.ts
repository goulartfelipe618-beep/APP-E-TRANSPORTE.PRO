const IBGE_BASE = "https://servicodados.ibge.gov.br/api/v1/localidades";

export type IbgeEstado = { id: number; sigla: string; nome: string };
export type IbgeMunicipio = { id: number; nome: string };

let estadosCache: IbgeEstado[] | null = null;

export async function fetchIbgeEstados(): Promise<IbgeEstado[]> {
  if (estadosCache?.length) return estadosCache;
  const res = await fetch(`${IBGE_BASE}/estados?orderBy=nome`);
  if (!res.ok) throw new Error(`IBGE estados: HTTP ${res.status}`);
  const data = (await res.json()) as IbgeEstado[];
  estadosCache = data;
  return data;
}

export async function fetchIbgeMunicipiosPorEstadoId(estadoId: number): Promise<IbgeMunicipio[]> {
  const res = await fetch(`${IBGE_BASE}/estados/${estadoId}/municipios?orderBy=nome`);
  if (!res.ok) throw new Error(`IBGE municípios: HTTP ${res.status}`);
  return (await res.json()) as IbgeMunicipio[];
}

export function findEstadoIdPorSigla(estados: IbgeEstado[], sigla: string): number | null {
  const s = sigla.trim().toUpperCase();
  const e = estados.find((x) => x.sigla === s);
  return typeof e?.id === "number" ? e.id : null;
}
