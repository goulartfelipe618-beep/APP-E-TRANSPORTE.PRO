/**
 * Infraestrutura de solicitação alinhada ao Google Business Profile (SAB — Service Area Business).
 * Campos automáticos simulam o envelope enviado ao backend/API; o motorista não pode alterá-los no front.
 *
 * Referência de categoria (GCID): taxonomia Google — usar apenas IDs estáveis aprovados pela operação.
 * @see https://developers.google.com/my-business/reference/businessinformation/rest/v1/accounts.locations
 */

export type GbpPrimaryCategoryEnvelope = {
  resourceName: string;
  gcid: string;
  displayLabel: string;
};

/** Categorias permitidas no painel (evita táxi/aluguel sem loja física, etc.). */
export const GBP_ALLOWED_PRIMARY_CATEGORIES = [
  {
    id: "private_car_service",
    gcid: "private_car_service",
    resourceName: "categories/gcid:private_car_service",
    displayLabelPt: "Serviço de transporte por carro particular",
    displayLabelEn: "Private car service",
  },
  {
    id: "chauffeur_service",
    gcid: "chauffeur_service",
    resourceName: "categories/gcid:chauffeur_service",
    displayLabelPt: "Serviço de motorista particular",
    displayLabelEn: "Chauffeur service",
  },
  {
    id: "transportation_service",
    gcid: "transportation_service",
    resourceName: "categories/gcid:transportation_service",
    displayLabelPt: "Serviço de transporte",
    displayLabelEn: "Transportation service",
  },
] as const;

export type GbpAllowedPrimaryCategoryId = (typeof GBP_ALLOWED_PRIMARY_CATEGORIES)[number]["id"];

/** Mapeia valores antigos do select (antes das restrições) para os novos IDs. */
const LEGACY_CATEGORY_TO_ALLOWED: Record<string, GbpAllowedPrimaryCategoryId> = {
  transporte_executivo: "private_car_service",
  taxi: "transportation_service",
  aluguel_veiculos: "transportation_service",
  limusine: "private_car_service",
  transporte_aeroporto: "transportation_service",
  shuttle: "transportation_service",
};

export function normalizeStoredGbpCategoryId(raw: string | undefined | null): GbpAllowedPrimaryCategoryId | "" {
  if (!raw) return "";
  if (GBP_ALLOWED_PRIMARY_CATEGORIES.some((c) => c.id === raw)) {
    return raw as GbpAllowedPrimaryCategoryId;
  }
  return LEGACY_CATEGORY_TO_ALLOWED[raw] ?? "";
}

export function resolveGbpPrimaryCategoryForEnvelope(id: string): GbpPrimaryCategoryEnvelope {
  const row =
    GBP_ALLOWED_PRIMARY_CATEGORIES.find((c) => c.id === id) ?? GBP_ALLOWED_PRIMARY_CATEGORIES[2];
  return {
    resourceName: row.resourceName,
    gcid: row.gcid,
    displayLabel: `${row.displayLabelPt} (${row.displayLabelEn})`,
  };
}

export function getGbpCategoryLabelForId(id: string): string {
  const row = GBP_ALLOWED_PRIMARY_CATEGORIES.find((c) => c.id === id);
  if (!row) return resolveGbpPrimaryCategoryForEnvelope(id).displayLabel;
  return `${row.displayLabelPt} (${row.displayLabelEn})`;
}

export type GbpVerificationAddress = {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  /** Linha única para verificação (ex.: resultado Mapbox) */
  linha_completa?: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type GbpServiceAreaPlace = {
  id: string;
  label: string;
  lat?: number;
  lng?: number;
};

export type GbpDaySchedule = {
  dayIndex: number;
  dayShort: string;
  dayName: string;
  enabled: boolean;
  open: string;
  close: string;
};

export type GbpAutomaticEnvelope = {
  schema: "gbp_sab_v1";
  service_area_business: true;
  /** Endereço não exibido ao público no Maps (somente verificação). */
  customer_location_hidden: true;
  primary_category: GbpPrimaryCategoryEnvelope;
  /** URL única por motorista — catálogo / reservas da plataforma. */
  website_uri: string;
};

const BANNED_TITLE_PATTERNS: RegExp[] = [
  /\bbarato\b/i,
  /\bbarata\b/i,
  /\bpromo(ç|c)(ã|a)o\b/i,
  /\b(des)?conto\b/i,
  /\bgr(á|a)tis\b/i,
  /\bgratuito\b/i,
  /\b24\s*h\b/i,
  /\b24h\b/i,
  /\b24\s*horas\b/i,
  /\b24x7\b/i,
  /\bmelhor\b/i,
  /\bmais\s+barato\b/i,
  /\b#\s*1\b/i,
  /\bn(º|o\.?)\s*1\b/i,
  /\bwhatsapp\b/i,
  /\bhttp\b/i,
  /\bwww\./i,
  /\bpre(ç|c)o\b/i,
  /\bpechincha\b/i,
  /\boferta\b/i,
  /\bexclusivo\b/i,
  /\bvip\b/i,
  /\bexecutivo\s+24\b/i,
  /\bcheap\b/i,
  /\bbest\b/i,
];

/** Palavras que costumam indicar keyword stuffing com cidade/região no nome. */
const LOCATION_STUFFING_HINTS =
  /\b(cambori(ú|u)|itaja(í|i)|balne(á|a)rio\s+cambori(ú|u)|florian(ó|o)polis|joinville|blumenau|curitiba|porto\s+alegre|s(ã|a)o\s+paulo|rio\s+de\s+janeiro|belo\s+horizonte|bras(í|i)lia|salvador|recife|fortaleza|manaus|vit(ó|o)ria|goi(â|a)nia|campinas|guarulhos|santos|navegantes|tubar(ã|a)o|londrina|maring(á|a)|uberl(â|a)ndia|ribeir(ã|a)o\s+preto|sorocaba|jundia(í|i)|osasco|s(ã|a)o\s+bernardo|santo\s+andr(é|e)|abc)\b/i;

const TITLE_DISALLOWED_SYMBOLS = /[<>{}[\]|\\^`~@#$%+=*_]{2,}/;

export function validateGbpBusinessTitle(title: string): { ok: true } | { ok: false; message: string } {
  const t = title.trim();
  if (t.length < 3) {
    return { ok: false, message: "Informe o nome profissional ou razão social (mínimo 3 caracteres)." };
  }
  if (t.length > 58) {
    return { ok: false, message: "Nome muito longo. Use até 58 caracteres — o Google rejeita nomes excessivos." };
  }
  if (/[!?]{2,}/.test(t)) {
    return { ok: false, message: "Evite muitos símbolos (! ?) no nome do negócio." };
  }
  if (TITLE_DISALLOWED_SYMBOLS.test(t)) {
    return {
      ok: false,
      message: "Evite símbolos especiais repetidos ou chamativos no nome (ex.: @, #, *, $). Use apenas nome ou razão social.",
    };
  }
  for (const re of BANNED_TITLE_PATTERNS) {
    if (re.test(t)) {
      return {
        ok: false,
        message:
          "O nome não pode conter termos promocionais, preços, \"24h\", links ou palavras como \"barato\" ou \"melhor\". Use apenas nome ou razão social.",
      };
    }
  }
  if (LOCATION_STUFFING_HINTS.test(t)) {
    return {
      ok: false,
      message:
        "Não inclua nomes de cidades ou regiões no título do negócio. Indique a área de atendimento na aba Localização — assim reduzimos risco de bloqueio pelo Google.",
    };
  }
  return { ok: true };
}

const DESCRIPTION_URL_RE = /https?:\/\/[^\s]+|www\.[^\s]+/gi;

/** Detecta telefones comuns na descrição (evita spam / duplicação do campo telefone). */
const DESCRIPTION_PHONEISH_RE =
  /\b(\+?55\s*)?(\(?\d{2}\)?[\s.-]*)?\d{4,5}[\s.-]?\d{4}\b|\b\d{10,11}\b/g;

function stripEmojiLike(s: string): string {
  try {
    return s.replace(/\p{Extended_Pictographic}/gu, "");
  } catch {
    return s;
  }
}

/** Remove URLs, telefones semelhantes e emojis; comprime espaços. */
export function sanitizeGbpBusinessDescription(input: string): string {
  let s = input.replace(DESCRIPTION_URL_RE, " ");
  s = s.replace(DESCRIPTION_PHONEISH_RE, " ");
  s = stripEmojiLike(s);
  return s.replace(/\s{2,}/g, " ").trim();
}

export function validateGbpBusinessDescription(raw: string): { ok: true } | { ok: false; message: string } {
  const t = raw.trim();
  if (t.length < 20) {
    return { ok: false, message: "A descrição deve ter pelo menos 20 caracteres (texto útil, sem links)." };
  }
  if (t.length > 750) {
    return { ok: false, message: "Descrição acima de 750 caracteres. Seja objetivo — o Google penaliza texto excessivo." };
  }
  if (DESCRIPTION_URL_RE.test(t) || /\bwww\.\S+/i.test(t)) {
    return { ok: false, message: "Remova links e URLs da descrição. Use o campo Website e as redes na aba Contato." };
  }
  if (DESCRIPTION_PHONEISH_RE.test(t)) {
    return { ok: false, message: "Não inclua telefones na descrição — use o campo Telefone na aba Contato." };
  }
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length >= 20 && letters === letters.toUpperCase()) {
    return {
      ok: false,
      message: "Evite texto inteiro em MAIÚSCULAS na descrição. Use frases normais (estilo frase).",
    };
  }
  return { ok: true };
}

function timeToMinutes(hhmm: string): number {
  const p = hhmm.slice(0, 5);
  const [h, m] = p.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m;
}

function isDayEffectively24h(d: { enabled: boolean; open: string; close: string }): boolean {
  if (!d.enabled) return false;
  const o = timeToMinutes(d.open);
  const c = timeToMinutes(d.close);
  if (Number.isNaN(o) || Number.isNaN(c)) return false;
  const span = c >= o ? c - o : c + 24 * 60 - o;
  return o <= 5 && span >= 23 * 60 + 45;
}

/**
 * Perfis novos com 24/7 em todos os dias sem histórico elevam risco de verificação manual no setor de transportes.
 */
export function validateGbpScheduleDeRisk(
  days: { enabled: boolean; open: string; close: string }[],
): { ok: true } | { ok: false; message: string } {
  if (days.length < 7) return { ok: true };
  const all24 = days.every((d) => isDayEffectively24h(d));
  if (all24) {
    return {
      ok: false,
      message:
        "Horário 24 horas em todos os dias aumenta risco de revisão manual no Google para transportes. " +
        "Deixe pelo menos um dia fechado ou use horário comercial (ex.: 08:00–20:00) em alguns dias, se isso refletir a sua operação.",
    };
  }
  return { ok: true };
}

export function normalizeBrazilPhoneDigits(input: string): string {
  return input.replace(/\D/g, "");
}

export function formatBrazilPhoneDisplay(digits: string): string {
  const d = normalizeBrazilPhoneDigits(digits);
  if (d.length <= 10) {
    const p1 = d.slice(0, 2);
    const p2 = d.slice(2, 6);
    const p3 = d.slice(6, 10);
    if (d.length <= 2) return p1 ? `(${p1}` : "";
    if (d.length <= 6) return `(${p1}) ${p2}`;
    return `(${p1}) ${p2}-${p3}`;
  }
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 7);
  const p3 = d.slice(7, 11);
  return `(${p1}) ${p2}-${p3}`;
}

/**
 * URL pública única por motorista para o campo website do GBP.
 * Defina `VITE_MOTORISTA_PUBLIC_BASE_URL` (ex.: https://seudominio.com.br/catalogo) — a URL final será `{base}/{userId}`.
 */
export function buildGbpWebsiteUriForUser(userId: string): string {
  const raw = (import.meta.env.VITE_MOTORISTA_PUBLIC_BASE_URL as string | undefined)?.trim();
  const base = (raw && raw.length > 0 ? raw.replace(/\/$/, "") : "") || `${typeof window !== "undefined" ? window.location.origin : ""}/catalogo`;
  return `${base}/${userId}`;
}

export function buildGbpAutomaticEnvelope(userId: string, primaryCategoryId: string): GbpAutomaticEnvelope {
  return {
    schema: "gbp_sab_v1",
    service_area_business: true,
    customer_location_hidden: true,
    primary_category: resolveGbpPrimaryCategoryForEnvelope(primaryCategoryId),
    website_uri: buildGbpWebsiteUriForUser(userId),
  };
}

export function buildGoogleSolicitacaoPayload(params: {
  userId: string;
  businessTitle: string;
  verificationAddress: GbpVerificationAddress;
  serviceAreas: GbpServiceAreaPlace[];
  primaryPhoneDigits: string;
  regularHours: GbpDaySchedule[];
  /** Uma das categorias permitidas em `GBP_ALLOWED_PRIMARY_CATEGORIES`. */
  primaryCategoryId: string;
}): Record<string, unknown> {
  const automatic = buildGbpAutomaticEnvelope(params.userId, params.primaryCategoryId);
  const plataforma_gbp_resumo =
    `Perfil SAB (área de atendimento; endereço de verificação não aparece no Maps). ` +
    `Categoria definida pela API: ${automatic.primary_category.displayLabel}. ` +
    `Site sugerido no perfil: ${automatic.website_uri}.`;

  return {
    schema_version: 3,
    business_title: params.businessTitle.trim(),
    verification_address: params.verificationAddress,
    service_areas: params.serviceAreas,
    primary_phone: params.primaryPhoneDigits,
    primary_phone_display: formatBrazilPhoneDisplay(params.primaryPhoneDigits),
    regular_hours: params.regularHours,
    plataforma_gbp_resumo,
    nome_empresa: params.businessTitle.trim(),
    service_area: true,
    area_atendimento: params.serviceAreas.map((a) => a.label).join(", "),
    gbp_primary_category_id: params.primaryCategoryId,
  };
}
