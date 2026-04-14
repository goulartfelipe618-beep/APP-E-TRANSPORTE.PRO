/**
 * Infraestrutura de solicitação alinhada ao Google Business Profile (SAB — Service Area Business).
 * Campos automáticos simulam o envelope enviado ao backend/API; o motorista não pode alterá-los no front.
 *
 * Referência de categoria (GCID): taxonomia Google — usar apenas IDs estáveis aprovados pela operação.
 * @see https://developers.google.com/my-business/reference/businessinformation/rest/v1/accounts.locations
 */

/** Categoria principal fixa na plataforma (evita keyword stuffing em categoria). */
export const GBP_FIXED_PRIMARY_CATEGORY = {
  /** Formato esperado pela API Business Information v1 */
  resourceName: "categories/gcid:taxi_service",
  gcid: "taxi_service",
  displayLabel: "Serviço de táxi (definido pela plataforma)",
} as const;

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
  primary_category: typeof GBP_FIXED_PRIMARY_CATEGORY;
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
  /\bmelhor\b/i,
  /\bmais\s+barato\b/i,
  /\b#\s*1\b/i,
  /\bn(º|o\.?)\s*1\b/i,
  /\bwhatsapp\b/i,
  /\bhttp\b/i,
  /\bwww\./i,
];

/** Palavras que costumam indicar keyword stuffing com cidade/região no nome. */
const LOCATION_STUFFING_HINTS =
  /\b(cambori(ú|u)|itaja(í|i)|florian(ó|o)polis|joinville|blumenau|curitiba|porto alegre|s(ã|a)o paulo|rio de janeiro|belo horizonte|bras(í|i)lia|salvador|recife|fortaleza|manaus)\b/i;

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
  for (const re of BANNED_TITLE_PATTERNS) {
    if (re.test(t)) {
      return {
        ok: false,
        message:
          "O nome não pode conter termos promocionais, preços, \"24h\", links ou palavras como \"barato\". Use apenas nome ou razão social.",
      };
    }
  }
  if (LOCATION_STUFFING_HINTS.test(t)) {
    return {
      ok: false,
      message:
        "Não inclua nomes de cidades no título do negócio. Indique a área de atendimento na etapa própria — assim reduzimos risco de bloqueio pelo Google.",
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

export function buildGbpAutomaticEnvelope(userId: string): GbpAutomaticEnvelope {
  return {
    schema: "gbp_sab_v1",
    service_area_business: true,
    customer_location_hidden: true,
    primary_category: { ...GBP_FIXED_PRIMARY_CATEGORY },
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
}): Record<string, unknown> {
  const automatic = buildGbpAutomaticEnvelope(params.userId);
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
  };
}
