/**
 * Briefing Google Business em formato legível (painel admin + PDF).
 * Evita achatamento cego de objetos aninhados (ex.: envelope da API).
 */

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function legacyEnvelopeSummary(env: unknown): string {
  if (!env || typeof env !== "object") return "—";
  const e = env as Record<string, unknown>;
  const parts: string[] = [];
  if (e.service_area_business === true) parts.push("SAB (área de atendimento)");
  if (e.customer_location_hidden === true) parts.push("endereço de verificação oculto no Maps");
  const cat = e.primary_category;
  if (cat && typeof cat === "object") {
    const c = cat as Record<string, unknown>;
    if (str(c.displayLabel)) parts.push(`Categoria API: ${str(c.displayLabel)}`);
    else if (str(c.gcid)) parts.push(`Categoria API (gcid): ${str(c.gcid)}`);
  }
  if (str(e.website_uri)) parts.push(`Site sugerido: ${str(e.website_uri)}`);
  return parts.join(" · ") || "—";
}

function formatVerificationAddress(v: unknown): string {
  if (!v || typeof v !== "object") return "—";
  const o = v as Record<string, unknown>;
  const line = [o.logradouro, o.numero, o.complemento, o.bairro, o.cidade, o.uf].map(str).filter(Boolean).join(", ");
  const cep = str(o.cep);
  return [line, cep ? `CEP: ${cep}` : ""].filter(Boolean).join(" · ") || "—";
}

function formatRegularHours(h: unknown): string {
  if (!Array.isArray(h) || h.length === 0) return "—";
  const lines = h.map((day) => {
    if (!day || typeof day !== "object") return "";
    const d = day as Record<string, unknown>;
    const name = str(d.dayName) || str(d.dayShort) || "Dia";
    if (d.enabled === false) return `${name}: fechado`;
    return `${name}: ${str(d.open) || "—"} às ${str(d.close) || "—"}`;
  });
  return lines.filter(Boolean).join("\n");
}

function serviceAreaLabels(areas: unknown): string {
  if (!Array.isArray(areas) || areas.length === 0) return "—";
  const labels = areas
    .map((x) => (x && typeof x === "object" && str((x as Record<string, unknown>).label)) || "")
    .filter(Boolean);
  return labels.join("; ") || "—";
}

function pushObjectRows(
  rows: { label: string; value: string }[],
  prefix: string,
  obj: unknown,
  keyLabels: Record<string, string>,
) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
  const o = obj as Record<string, unknown>;
  const entries = Object.entries(o).filter(([, v]) => v !== "" && v !== null && v !== undefined);
  for (const [k, v] of entries) {
    if (typeof v === "object") continue;
    rows.push({
      label: `${prefix}: ${keyLabels[k] || k.replace(/_/g, " ")}`,
      value: typeof v === "boolean" ? (v ? "Sim" : "Não") : str(v) || "—",
    });
  }
}

const INFO_KEYS: Record<string, string> = {
  categoria_principal: "Categoria principal",
  categoria_secundaria: "Categoria secundária",
  descricao: "Descrição do negócio",
  ano_abertura: "Ano de abertura",
  identificador_curto: "Identificador curto (short name)",
};

const CONTATO_KEYS: Record<string, string> = {
  telefone_secundario: "Telefone secundário",
  whatsapp: "WhatsApp",
  website: "Website",
  link_agendamento: "Link de agendamento",
  link_menu: "Link do menu / cardápio",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};

const LOC_KEYS: Record<string, string> = {
  endereco: "Endereço (referência)",
  bairro: "Bairro",
  cep: "CEP",
  cidade: "Cidade",
  estado: "Estado",
  pais: "País",
  latitude: "Latitude",
  longitude: "Longitude",
  areas_texto_livre: "Áreas (texto livre)",
};

/** Linhas ordenadas para PDF e leitura no painel admin. */
export function googleBriefingRows(dados: Record<string, unknown> | null | undefined): { label: string; value: string }[] {
  if (!dados || typeof dados !== "object") return [];
  const rows: { label: string; value: string }[] = [];

  if (str(dados.business_title)) rows.push({ label: "Nome do negócio", value: str(dados.business_title) });
  if (str(dados.nome_empresa) && str(dados.nome_empresa) !== str(dados.business_title)) {
    rows.push({ label: "Nome empresa (campo auxiliar)", value: str(dados.nome_empresa) });
  }

  const info = dados.informacoes_perfil ?? dados.informacoes_negocio;
  pushObjectRows(rows, "Informações do perfil", info, INFO_KEYS);

  rows.push({ label: "Endereço de verificação (SAB — não exibido no Maps)", value: formatVerificationAddress(dados.verification_address) });

  rows.push({ label: "Áreas de atendimento", value: serviceAreaLabels(dados.service_areas) });
  if (str(dados.area_atendimento) && str(dados.area_atendimento) !== serviceAreaLabels(dados.service_areas)) {
    rows.push({ label: "Área de atendimento (texto legado)", value: str(dados.area_atendimento) });
  }

  if (str(dados.primary_phone_display) || str(dados.primary_phone)) {
    rows.push({
      label: "Telefone principal (WhatsApp / contato)",
      value: str(dados.primary_phone_display) || str(dados.primary_phone),
    });
  }

  rows.push({ label: "Horário de funcionamento", value: formatRegularHours(dados.regular_hours) });

  pushObjectRows(rows, "Contato", dados.contato_exibicao, CONTATO_KEYS);
  pushObjectRows(rows, "Localização de referência", dados.localizacao_opcional_maps, LOC_KEYS);

  if (str(dados.plataforma_gbp_resumo)) {
    rows.push({ label: "Regras da plataforma / API Google", value: str(dados.plataforma_gbp_resumo) });
  } else if (dados.gbp_automatic_envelope) {
    rows.push({ label: "Regras da plataforma / API Google (legado)", value: legacyEnvelopeSummary(dados.gbp_automatic_envelope) });
  }

  if (Array.isArray(dados.horarios_especiais) && dados.horarios_especiais.length > 0) {
    rows.push({
      label: "Horários especiais",
      value: dados.horarios_especiais
        .map((h: unknown) => {
          if (!h || typeof h !== "object") return "";
          const x = h as Record<string, unknown>;
          const date = str(x.date);
          if (x.closed === true) return `${date}: fechado`;
          return `${date}: ${str(x.open)}–${str(x.close)}`;
        })
        .filter(Boolean)
        .join("\n"),
    });
  }

  if (Array.isArray(dados.publicacoes_rascunho) && dados.publicacoes_rascunho.length > 0) {
    rows.push({
      label: "Publicações (rascunho)",
      value: `${dados.publicacoes_rascunho.length} item(ns) — ver JSON completo se necessário.`,
    });
  }
  if (Array.isArray(dados.produtos_rascunho) && dados.produtos_rascunho.length > 0) {
    rows.push({ label: "Produtos (rascunho)", value: `${dados.produtos_rascunho.length} item(ns)` });
  }
  if (Array.isArray(dados.servicos_rascunho) && dados.servicos_rascunho.length > 0) {
    rows.push({ label: "Serviços (rascunho)", value: `${dados.servicos_rascunho.length} item(ns)` });
  }

  if (dados.atributos && typeof dados.atributos === "object" && !Array.isArray(dados.atributos)) {
    const a = dados.atributos as Record<string, unknown>;
    const active = Object.entries(a)
      .filter(([, v]) => v === true)
      .map(([k]) => k.replace(/_/g, " "));
    if (active.length > 0) rows.push({ label: "Atributos marcados", value: active.join(", ") });
  }

  return rows;
}
