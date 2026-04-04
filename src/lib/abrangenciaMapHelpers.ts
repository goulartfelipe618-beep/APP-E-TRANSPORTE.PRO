/**
 * Primeiro ponto de embarque quando há vários endereços no mesmo campo (quebras de linha, `;` ou `|`).
 * Usado no mapa de Abrangência: um PIN por reserva, só no primeiro embarque.
 */
export function primeiroSegmentoEndereco(raw: string | null | undefined): string {
  if (raw == null) return "";
  const t = raw.trim();
  if (!t) return "";
  const firstLine = t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] ?? t;
  const semi = firstLine.split(";").map((s) => s.trim()).filter(Boolean);
  const afterSemi = semi.length > 1 ? semi[0]! : firstLine;
  const pipe = afterSemi.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean);
  return pipe.length > 1 ? pipe[0]! : afterSemi;
}

/** Coordenadas aproximadas do centro urbano; chaves em minúsculas (com acento) — compartilhado entre Admin Abrangência e Motorista Abrangência. */

const rawCityCoords: Record<string, [number, number]> = {
  "são paulo": [-23.5505, -46.6333],
  "rio de janeiro": [-22.9068, -43.1729],
  "belo horizonte": [-19.9167, -43.9345],
  brasília: [-15.7939, -47.8828],
  curitiba: [-25.4284, -49.2733],
  salvador: [-12.9714, -38.5124],
  fortaleza: [-3.7172, -38.5433],
  recife: [-8.0476, -34.877],
  "porto alegre": [-30.0346, -51.2177],
  manaus: [-3.119, -60.0217],
  belém: [-1.4558, -48.5024],
  goiânia: [-16.6869, -49.2648],
  guarulhos: [-23.4538, -46.5333],
  campinas: [-22.9099, -47.0626],
  santos: [-23.9608, -46.3336],
  "florianópolis": [-27.5954, -48.548],
  vitória: [-20.3155, -40.3128],
  natal: [-5.7945, -35.211],
  "campo grande": [-20.4697, -54.6201],
  teresina: [-5.0892, -42.8019],
  "joão pessoa": [-7.1195, -34.845],
  maceió: [-9.6658, -35.7353],
  aracaju: [-10.9091, -37.0677],
  cuiabá: [-15.601, -56.0974],
  "são luís": [-2.5297, -44.2825],
  londrina: [-23.3045, -51.1696],
  niterói: [-22.8833, -43.1036],
  uberlândia: [-18.9186, -48.2772],
  "ribeirão preto": [-21.1704, -47.8103],
  sorocaba: [-23.5015, -47.4526],
  joinville: [-26.3045, -48.8487],
  osasco: [-23.5325, -46.7917],
  "são josé dos campos": [-23.1896, -45.884],
  maringá: [-23.4205, -51.9333],
  piracicaba: [-22.7338, -47.6476],
  jundiaí: [-23.1857, -46.8978],
  bauru: [-22.3246, -49.0871],
  "são bernardo do campo": [-23.6914, -46.5646],
  "santo andré": [-23.6737, -46.5432],
  "são josé do rio preto": [-20.8113, -49.3758],
  "balneário camboriú": [-26.9926, -48.6347],
  "balneario camboriu": [-26.9926, -48.6347],
  itajaí: [-26.9078, -48.6619],
  itajai: [-26.9078, -48.6619],
  camboriú: [-27.0306, -48.6547],
  camboriu: [-27.0306, -48.6547],
  navegantes: [-26.8978, -48.6542],
  gaspar: [-26.9314, -48.9589],
  blumenau: [-26.9194, -49.0661],
  brusque: [-27.0978, -48.9118],
  chapecó: [-27.0964, -52.618],
  chapeco: [-27.0964, -52.618],
  criciúma: [-28.6773, -49.3697],
  criciuma: [-28.6773, -49.3697],
  "são josé": [-27.5954, -48.6236],
  "sao jose": [-27.5954, -48.6236],
  tubarão: [-28.4703, -49.0139],
  tubarao: [-28.4703, -49.0139],
};

function normalizeCityKey(city: string): string {
  return city
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const cityCoordsNormalized: Record<string, [number, number]> = {};
for (const [key, coords] of Object.entries(rawCityCoords)) {
  cityCoordsNormalized[normalizeCityKey(key)] = coords;
}

export function findCoords(city: string): [number, number] | null {
  const normalized = normalizeCityKey(city);
  if (!normalized) return null;
  if (cityCoordsNormalized[normalized]) return cityCoordsNormalized[normalized];
  for (const [key, coords] of Object.entries(cityCoordsNormalized)) {
    if (normalized.includes(key) || key.includes(normalized)) return coords;
  }
  return null;
}

export function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
