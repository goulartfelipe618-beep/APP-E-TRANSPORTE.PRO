import jsPDF from "jspdf";
import { googleBriefingRows } from "@/lib/googleBriefingDisplay";

const MARGIN = 14;
const PAGE_W = 210;
const LINE_H = 4.5;
const TITLE_FS = 15;
const SECTION_FS = 10.5;
const BODY_FS = 8.5;
const LABEL_W = 52;
const SAFE_BOTTOM = 285;

function humanizeKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Achata objetos aninhados (briefing website, redes sociais, etc.) em linhas legíveis. */
export function flattenBriefingData(obj: unknown, prefix = ""): { label: string; value: string }[] {
  if (obj === null || obj === undefined) return [];
  if (typeof obj === "boolean") {
    return [{ label: prefix || "Valor", value: obj ? "Sim" : "Não" }];
  }
  if (typeof obj === "number") {
    return [{ label: prefix || "Valor", value: String(obj) }];
  }
  if (typeof obj === "string") {
    return [{ label: prefix || "Valor", value: obj.trim() || "—" }];
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return [{ label: humanizeKey(prefix) || "Lista", value: "—" }];
    if (obj.every((x) => x === null || ["string", "number", "boolean"].includes(typeof x))) {
      return [
        {
          label: humanizeKey(prefix) || "Itens",
          value: obj.map((x) => (typeof x === "boolean" ? (x ? "Sim" : "Não") : String(x))).join(", "),
        },
      ];
    }
    const rows: { label: string; value: string }[] = [];
    obj.forEach((item, i) => {
      const p = prefix ? `${prefix} [${i + 1}]` : `Item ${i + 1}`;
      rows.push(...flattenBriefingData(item, p));
    });
    return rows;
  }
  if (typeof obj === "object") {
    const rows: { label: string; value: string }[] = [];
    const entries = Object.entries(obj as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    for (const [k, v] of entries) {
      const path = prefix ? `${prefix} › ${humanizeKey(k)}` : humanizeKey(k);
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        rows.push(...flattenBriefingData(v, path));
      } else if (Array.isArray(v)) {
        rows.push(...flattenBriefingData(v, path));
      } else {
        let valStr = "—";
        if (v === true) valStr = "Sim";
        else if (v === false) valStr = "Não";
        else if (v !== null && v !== undefined) valStr = String(v);
        rows.push({ label: path, value: valStr });
      }
    }
    return rows;
  }
  return [];
}

function checkY(doc: jsPDF, y: number, need: number): number {
  if (y + need > SAFE_BOTTOM) {
    doc.addPage();
    return MARGIN + 6;
  }
  return y;
}

function wrapValue(doc: jsPDF, text: string, x: number, y: number, maxW: number): number {
  const lines = doc.splitTextToSize(text || "—", maxW);
  let cy = y;
  for (const line of lines) {
    cy = checkY(doc, cy, LINE_H + 1);
    doc.text(line, x, cy);
    cy += LINE_H;
  }
  return cy;
}

export type SolicitacaoPdfInput = {
  id: string;
  user_id: string;
  tipo_servico: string;
  status: string;
  dados_solicitacao: Record<string, unknown> | null;
  created_at: string;
  link_acesso?: string | null;
  data_expiracao?: string | null;
  instrucoes_acesso?: string | null;
  como_usar?: string | null;
  observacoes_admin?: string | null;
};

const TIPO_PT: Record<string, string> = {
  website: "Website",
  email: "E-mail Business",
  google: "Google Business",
  dominio: "Domínio",
};

const STATUS_PT: Record<string, string> = {
  pendente: "Pendente / Em análise",
  em_andamento: "Em andamento",
  pendente_verificacao: "Pendente verificação (Google Business Profile)",
  concluido: "Concluído",
  publicado: "Website publicado",
  recusado: "Recusado",
};

/**
 * Gera PDF do briefing / dados da solicitação (admin master).
 * `overrides` reflete o que está no formulário (mesmo antes de salvar).
 */
export function downloadSolicitacaoBriefingPdf(
  row: SolicitacaoPdfInput,
  overrides?: Partial<{
    status: string;
    link_acesso: string | null;
    data_expiracao: string | null;
    instrucoes_acesso: string | null;
    como_usar: string | null;
    observacoes_admin: string | null;
  }>,
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(TITLE_FS);
  doc.text("Solicitação de serviço — Briefing completo", MARGIN, MARGIN + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(BODY_FS);
  doc.setTextColor(80, 80, 80);
  doc.text("Documento gerado para uso interno / produção", MARGIN, MARGIN + 12);
  doc.setTextColor(0, 0, 0);

  let y = MARGIN + 22;

  const status = overrides?.status ?? row.status;
  const link = overrides?.link_acesso ?? row.link_acesso;
  const exp = overrides?.data_expiracao ?? row.data_expiracao;
  const instr = overrides?.instrucoes_acesso ?? row.instrucoes_acesso;
  const como = overrides?.como_usar ?? row.como_usar;
  const obs = overrides?.observacoes_admin ?? row.observacoes_admin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(SECTION_FS);
  y = checkY(doc, y, 10);
  doc.text("1. Identificação", MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(BODY_FS);
  doc.setDrawColor(220);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;

  const identRows: { l: string; v: string }[] = [
    { l: "Tipo de serviço", v: TIPO_PT[row.tipo_servico] || row.tipo_servico },
    { l: "ID da solicitação", v: row.id },
    { l: "ID do usuário (motorista)", v: row.user_id },
    { l: "Data do pedido", v: new Date(row.created_at).toLocaleString("pt-BR") },
    { l: "Status", v: STATUS_PT[status] || status },
  ];
  for (const { l, v } of identRows) {
    y = checkY(doc, y, LINE_H + 2);
    doc.setFont("helvetica", "bold");
    doc.text(`${l}:`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    const vx = MARGIN + LABEL_W;
    y = wrapValue(doc, v, vx, y, PAGE_W - MARGIN - vx);
    y += 1;
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(SECTION_FS);
  y = checkY(doc, y, 10);
  doc.text("2. Dados do pedido (briefing / formulário)", MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(BODY_FS);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;

  const dados = row.dados_solicitacao && typeof row.dados_solicitacao === "object" ? row.dados_solicitacao : {};
  const flat =
    row.tipo_servico === "google"
      ? googleBriefingRows(dados as Record<string, unknown>)
      : flattenBriefingData(dados);
  if (flat.length === 0) {
    y = checkY(doc, y, LINE_H);
    doc.text("Nenhum dado estruturado registrado.", MARGIN, y);
    y += LINE_H + 2;
  } else {
    const contentW = PAGE_W - MARGIN * 2;
    for (const { label, value } of flat) {
      y = checkY(doc, y, LINE_H + 2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(BODY_FS - 0.5);
      y = wrapValue(doc, label, MARGIN, y, contentW);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(BODY_FS);
      y = wrapValue(doc, value, MARGIN + 3, y, contentW - 3);
      y += 2.5;
    }
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(SECTION_FS);
  y = checkY(doc, y, 10);
  doc.text("3. Resposta administrativa (painel)", MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(BODY_FS);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;

  const adminBlocks: { l: string; v: string }[] = [
    { l: "Link de acesso", v: (link && String(link).trim()) || "—" },
    { l: "Data de expiração", v: exp ? new Date(exp).toLocaleDateString("pt-BR") : "—" },
    { l: "Instruções de acesso", v: (instr && String(instr).trim()) || "—" },
    { l: "Como usar", v: (como && String(como).trim()) || "—" },
    { l: "Observações", v: (obs && String(obs).trim()) || "—" },
  ];
  for (const { l, v } of adminBlocks) {
    y = checkY(doc, y, LINE_H + 2);
    doc.setFont("helvetica", "bold");
    doc.text(`${l}`, MARGIN, y);
    y += LINE_H;
    doc.setFont("helvetica", "normal");
    y = wrapValue(doc, v, MARGIN + 2, y, PAGE_W - MARGIN - 4);
    y += 3;
  }

  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  y = checkY(doc, y, 8);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")} — Plataforma E-Transporte`,
    MARGIN,
    SAFE_BOTTOM - 4,
  );

  const tipoSlug = (TIPO_PT[row.tipo_servico] || row.tipo_servico).replace(/\s+/g, "-").toLowerCase();
  const shortId = row.id.slice(0, 8);
  doc.save(`briefing-${tipoSlug}-${shortId}.pdf`);
}
