import jsPDF from "jspdf";
import type { Tables } from "@/integrations/supabase/types";

type ReservaTransfer = Tables<"reservas_transfer">;
type ReceptivoRow = Tables<"receptivos">;

export type ReceptivoFooterPayload = {
  nomeCliente: string;
  numeroReserva: number | null;
  tipoLabel: string;
  embarque: string;
  desembarque: string;
  voltaEmb: string | null;
  voltaDesemb: string | null;
  idaData: string | null;
  idaHora: string | null;
  voltaData: string | null;
  voltaHora: string | null;
};

const tipoLabels: Record<string, string> = {
  somente_ida: "Somente ida",
  ida_volta: "Ida e volta",
  por_hora: "Disponibilidade por hora",
};

/**
 * Deve coincidir com a coluna `receptivos.receptivo_pdf_layout_version` e com a migração
 * `20260404130300_receptivos_pdf_layout_version.sql`.
 */
export const RECEPTIVO_PDF_LAYOUT_VERSION = "v2" as const;

/** Margem externa (~20mm). Espaço entre fim da linha da borda e o canto da página (~15mm). */
const M_OUT = 20;
/** Margem interna uniforme entre a borda arredondada e o conteúdo (Modelo 1). */
const M_IN = 10;
const G_CORNER = 15;
/** Cantos mais abertos (Modelo 4 — linhas longas, muito espaço nos cantos). */
const G_CORNER_MODEL4 = 26;
const BORDER_LINE_MM = 0.35;

/** Logo: altura equivalente entre ~60px e ~90px em 96dpi → mm (antes do fator visual). */
const PX96_TO_MM = 25.4 / 96;
const LOGO_H_MIN_MM = 60 * PX96_TO_MM;
const LOGO_H_MAX_MM = 90 * PX96_TO_MM;
/** Ampliação da logo no PDF; limitada à folha para não sobrepor nome/traço. */
const LOGO_SCALE_FACTOR = 4.75;
const LOGO_MAX_HEIGHT_FRAC_H = 0.34;
const LOGO_MAX_WIDTH_FRAC_INNER = 0.92;
/** Espaço entre o fim da logo e o início do nome do cliente (modelos 1–4). */
const LOGO_TO_NOME_GAP_MM = 26;

/** Nome do cliente: faixa de tamanho (pt) — valores menores = bloco mais baixo. */
const NOME_FS_MIN = 26;
const NOME_FS_MAX = 46;
/** Entrelinha do nome (menor = altura total do texto menor). */
const NOME_LINE_LEADING = 1.1;

/** Posição aproximada do traço horizontal no PNG do Modelo 1 (fração da altura H, de cima para baixo). */
const M1_TEMPLATE_LINE_Y_FRAC = 0.77;
/** Logo: distância do topo da folha (mm). */
const M1_LOGO_TOP_MM = 22;

/** Modelo 2 — PNG de fundo: posição do traço e logo (ajustar ao arte-final). */
const M2_TEMPLATE_LINE_Y_FRAC = 0.77;
const M2_LOGO_TOP_MM = 22;

/** Modelo 3 — PNG de fundo (moldura + traço no arte; ajustar ao PNG). */
const M3_TEMPLATE_LINE_Y_FRAC = 0.77;
const M3_LOGO_TOP_MM = 22;

/** Modelo 4 — PNG de fundo (moldura aberta + traço no arte; ajustar ao PNG). */
const M4_TEMPLATE_LINE_Y_FRAC = 0.77;
const M4_LOGO_TOP_MM = 22;

export function buildFooterPayloadFromReceptivoRow(row: ReceptivoRow): ReceptivoFooterPayload {
  const semReserva = !row.reserva_transfer_id && row.reserva_numero == null;
  if (semReserva) {
    return {
      nomeCliente: row.nome_cliente,
      numeroReserva: null,
      tipoLabel: "",
      embarque: "",
      desembarque: "",
      voltaEmb: null,
      voltaDesemb: null,
      idaData: null,
      idaHora: null,
      voltaData: null,
      voltaHora: null,
    };
  }
  const tv = row.tipo_viagem || "";
  return {
    nomeCliente: row.nome_cliente,
    numeroReserva: row.reserva_numero,
    tipoLabel: tipoLabels[tv] || tv || "—",
    embarque: row.embarque || "",
    desembarque: row.desembarque || "",
    voltaEmb: row.volta_embarque,
    voltaDesemb: row.volta_desembarque,
    idaData: row.ida_data,
    idaHora: row.ida_hora,
    voltaData: row.volta_data,
    voltaHora: row.volta_hora,
  };
}

export function buildFooterPayloadFromReserva(
  reserva: ReservaTransfer | null,
  nomeCliente: string,
): ReceptivoFooterPayload {
  if (!reserva) {
    return {
      nomeCliente,
      numeroReserva: null,
      tipoLabel: "",
      embarque: "",
      desembarque: "",
      voltaEmb: null,
      voltaDesemb: null,
      idaData: null,
      idaHora: null,
      voltaData: null,
      voltaHora: null,
    };
  }
  const tv = reserva.tipo_viagem || "";
  let embarque = "";
  let desembarque = "";
  if (tv === "por_hora") {
    embarque = reserva.por_hora_endereco_inicio?.trim() || "—";
    desembarque = reserva.por_hora_ponto_encerramento?.trim() || "—";
  } else {
    embarque = reserva.ida_embarque?.trim() || "—";
    desembarque = reserva.ida_desembarque?.trim() || "—";
  }
  return {
    nomeCliente,
    numeroReserva: reserva.numero_reserva,
    tipoLabel: tipoLabels[tv] || tv || "—",
    embarque,
    desembarque,
    voltaEmb: tv === "ida_volta" ? reserva.volta_embarque?.trim() || null : null,
    voltaDesemb: tv === "ida_volta" ? reserva.volta_desembarque?.trim() || null : null,
    idaData: reserva.ida_data,
    idaHora: reserva.ida_hora,
    voltaData: reserva.volta_data,
    voltaHora: reserva.volta_hora,
  };
}

export function getEnderecosReservaParaExibicao(r: ReservaTransfer): { embarque: string; desembarque: string } {
  const tv = r.tipo_viagem || "";
  if (tv === "por_hora") {
    return {
      embarque: r.por_hora_endereco_inicio?.trim() || "—",
      desembarque: r.por_hora_ponto_encerramento?.trim() || "—",
    };
  }
  return {
    embarque: r.ida_embarque?.trim() || "—",
    desembarque: r.ida_desembarque?.trim() || "—",
  };
}

function imageFormatFromDataUrl(dataUrl: string): "PNG" | "JPEG" {
  return /image\/jpe?g/i.test(dataUrl) ? "JPEG" : "PNG";
}

export async function loadImageDataUrl(url: string): Promise<string | null> {
  if (!url?.trim()) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** PNG de fundo do Modelo 1 (`public/receptivos/modelo-1-template.png`). */
export async function loadModelo1TemplateDataUrl(): Promise<string | null> {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return loadImageDataUrl(`${prefix}receptivos/modelo-1-template.png`);
}

/** PNG de fundo do Modelo 2 (`public/receptivos/modelo-2-template.png`). */
export async function loadModelo2TemplateDataUrl(): Promise<string | null> {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return loadImageDataUrl(`${prefix}receptivos/modelo-2-template.png`);
}

/** PNG de fundo do Modelo 3 (`public/receptivos/modelo-3-template.png`). */
export async function loadModelo3TemplateDataUrl(): Promise<string | null> {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return loadImageDataUrl(`${prefix}receptivos/modelo-3-template.png`);
}

/** PNG de fundo do Modelo 4 (`public/receptivos/modelo-4-template.png`). */
export async function loadModelo4TemplateDataUrl(): Promise<string | null> {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return loadImageDataUrl(`${prefix}receptivos/modelo-4-template.png`);
}

function getNaturalImageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
}

function capLogoToPage(
  wMm: number,
  hMm: number,
  innerW: number,
  pageHeightMm: number,
): { wMm: number; hMm: number } {
  const maxW = innerW * LOGO_MAX_WIDTH_FRAC_INNER;
  const maxH = pageHeightMm * LOGO_MAX_HEIGHT_FRAC_H;
  let w = wMm;
  let h = hMm;
  const aspect = w / Math.max(h, 0.01);
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  if (w > maxW) {
    w = maxW;
    h = w / aspect;
  }
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return { wMm: w, hMm: h };
}

/** Logo sem distorção; ~LOGO_SCALE_FACTOR× o tamanho base, limitada à área útil da folha. */
async function computeLogoDrawMm(
  logoDataUrl: string,
  innerW: number,
  pageHeightMm: number,
): Promise<{ wMm: number; hMm: number }> {
  const { w: nw, h: nh } = await getNaturalImageSize(logoDataUrl);
  if (!nh || !nw) {
    return capLogoToPage(40 * LOGO_SCALE_FACTOR, 18 * LOGO_SCALE_FACTOR, innerW, pageHeightMm);
  }
  const aspect = nw / nh;
  let hMm = nh * PX96_TO_MM;
  hMm = Math.min(LOGO_H_MAX_MM, Math.max(LOGO_H_MIN_MM, hMm));
  let wMm = hMm * aspect;
  hMm *= LOGO_SCALE_FACTOR;
  wMm *= LOGO_SCALE_FACTOR;
  return capLogoToPage(wMm, hMm, innerW, pageHeightMm);
}

/** Borda em 4 segmentos; cantos abertos (linhas não se encontram). `cornerGapMm` = espaço entre extremidade da linha e o canto da moldura. */
function drawOpenCornerBorder(doc: jsPDF, W: number, H: number, cornerGapMm: number = G_CORNER) {
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(BORDER_LINE_MM);
  const x0 = M_OUT + cornerGapMm;
  const x1 = W - M_OUT - cornerGapMm;
  const y0 = M_OUT + cornerGapMm;
  const y1 = H - M_OUT - cornerGapMm;
  doc.line(x0, M_OUT, x1, M_OUT);
  doc.line(x0, H - M_OUT, x1, H - M_OUT);
  doc.line(M_OUT, y0, M_OUT, y1);
  doc.line(W - M_OUT, y0, W - M_OUT, y1);
}

/** Traço com marcas; `widthFrac` da largura útil (ex.: 0.65–0.70). */
function drawTraçoCentralComTicks(
  doc: jsPDF,
  W: number,
  y: number,
  innerW: number,
  widthFrac = 0.7,
  lineWidthMm = BORDER_LINE_MM,
) {
  const tw = innerW * widthFrac;
  const x0 = (W - tw) / 2;
  const tick = lineWidthMm < 0.3 ? 1.2 : 1.4;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(lineWidthMm);
  doc.line(x0, y, x0 + tw, y);
  doc.line(x0, y - tick, x0, y + tick);
  doc.line(x0 + tw, y - tick, x0 + tw, y + tick);
}

/** Borda única com cantos arredondados (área útil, sem encostar na folha). */
function drawRoundedUsefulBorder(doc: jsPDF, W: number, H: number) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(BORDER_LINE_MM);
  const rx = 10;
  const ry = 10;
  doc.roundedRect(M_OUT, M_OUT, W - 2 * M_OUT, H - 2 * M_OUT, rx, ry, "S");
}

function wrapLines(doc: jsPDF, text: string, maxW: number, fontSize: number): string[] {
  doc.setFontSize(fontSize);
  return doc.splitTextToSize(text || "—", maxW);
}

function drawTripFooter(
  doc: jsPDF,
  xLeft: number,
  y: number,
  maxW: number,
  f: ReceptivoFooterPayload,
): number {
  if (f.numeroReserva == null) return y;
  doc.setTextColor(35, 35, 35);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Detalhes da viagem", xLeft, y);
  let cy = y + 4.2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const reservaTxt = `Reserva nº ${f.numeroReserva}  |  Tipo: ${f.tipoLabel || "—"}`;
  wrapLines(doc, reservaTxt, maxW, 7).forEach((line) => {
    doc.text(line, xLeft, cy);
    cy += 3.4;
  });
  const lines: string[] = [
    `Embarque: ${f.embarque || "—"}`,
    `Desembarque: ${f.desembarque || "—"}`,
  ];
  if (f.idaData || f.idaHora) {
    lines.push(`Data/hora (ida): ${[f.idaData, f.idaHora].filter(Boolean).join(" · ") || "—"}`);
  }
  if (f.voltaEmb || f.voltaDesemb) {
    lines.push(`Volta — Embarque: ${f.voltaEmb || "—"}`);
    lines.push(`Volta — Desembarque: ${f.voltaDesemb || "—"}`);
  }
  if (f.voltaData || f.voltaHora) {
    lines.push(`Data/hora (volta): ${[f.voltaData, f.voltaHora].filter(Boolean).join(" · ") || "—"}`);
  }
  lines.forEach((t) => {
    wrapLines(doc, t, maxW, 7).forEach((line) => {
      doc.text(line, xLeft, cy);
      cy += 3.4;
    });
  });
  doc.setTextColor(0, 0, 0);
  return cy + 1;
}

/** Rodapé de viagem centralizado (Modelos 1 e 2). `bracedTitle`: título como `{ Detalhes da viagem }` (ref. Modelo 2). */
function drawTripFooterCentered(
  doc: jsPDF,
  centerX: number,
  y: number,
  maxW: number,
  f: ReceptivoFooterPayload,
  opts?: { bracedTitle?: boolean },
): number {
  if (f.numeroReserva == null) return y;
  doc.setTextColor(35, 35, 35);
  let cy: number;
  if (opts?.bracedTitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("{ Detalhes da viagem }", centerX, y, { align: "center" });
    cy = y + 4.2;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Detalhes da viagem", centerX, y, { align: "center" });
    cy = y + 4.2;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const reservaTxt = `Reserva nº ${f.numeroReserva}  |  Tipo: ${f.tipoLabel || "—"}`;
  wrapLines(doc, reservaTxt, maxW, 7).forEach((line) => {
    doc.text(line, centerX, cy, { align: "center" });
    cy += 3.4;
  });
  const lines: string[] = [
    `Embarque: ${f.embarque || "—"}`,
    `Desembarque: ${f.desembarque || "—"}`,
  ];
  if (f.idaData || f.idaHora) {
    lines.push(`Data/hora (ida): ${[f.idaData, f.idaHora].filter(Boolean).join(" · ") || "—"}`);
  }
  if (f.voltaEmb || f.voltaDesemb) {
    lines.push(`Volta — Embarque: ${f.voltaEmb || "—"}`);
    lines.push(`Volta — Desembarque: ${f.voltaDesemb || "—"}`);
  }
  if (f.voltaData || f.voltaHora) {
    lines.push(`Data/hora (volta): ${[f.voltaData, f.voltaHora].filter(Boolean).join(" · ") || "—"}`);
  }
  lines.forEach((t) => {
    wrapLines(doc, t, maxW, 7).forEach((line) => {
      doc.text(line, centerX, cy, { align: "center" });
      cy += 3.4;
    });
  });
  doc.setTextColor(0, 0, 0);
  return cy + 1;
}

/** Nome centralizado, negrito, em maiúsculas (faixa NOME_FS_MIN–NOME_FS_MAX) — prioriza fonte o maior possível. */
function drawNomeClienteComChaves(
  doc: jsPDF,
  nome: string,
  centerX: number,
  yTop: number,
  maxW: number,
): number {
  const upper = nome.trim().toUpperCase();
  const display = upper;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  let fs = NOME_FS_MAX;
  let lines: string[] = [];
  for (let i = 0; i < 14; i++) {
    doc.setFontSize(fs);
    lines = doc.splitTextToSize(display, maxW);
    const estH = lines.length * ((fs * NOME_LINE_LEADING * 25.4) / 72);
    if (lines.length <= 4 && estH < 40) break;
    fs = Math.max(NOME_FS_MIN, fs - 2);
  }
  doc.setFontSize(fs);
  lines = doc.splitTextToSize(display, maxW);
  const lineH = (fs * NOME_LINE_LEADING * 25.4) / 72;
  let y = yTop;
  lines.forEach((ln) => {
    doc.text(ln, centerX, y, { align: "center" });
    y += lineH;
  });
  return y;
}

/**
 * Nome em maiúsculas, limitado verticalmente para caber acima de traço + rodapé + logo.
 * `maxBlockBottomY` = último Y permitido para a base do bloco do nome (aprox.).
 */
function drawNomeClienteComChavesFit(
  doc: jsPDF,
  nome: string,
  centerX: number,
  yTop: number,
  maxW: number,
  maxBlockBottomY: number,
): number {
  const upper = nome.trim().toUpperCase();
  const display = upper;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  let fs = NOME_FS_MAX;
  let lines: string[] = [];
  for (let i = 0; i < 18; i++) {
    doc.setFontSize(fs);
    lines = doc.splitTextToSize(display, maxW);
    const lineH = (fs * NOME_LINE_LEADING * 25.4) / 72;
    const blockBottom = yTop + lines.length * lineH;
    if (blockBottom <= maxBlockBottomY && lines.length <= 5) break;
    fs = Math.max(NOME_FS_MIN, fs - 2);
  }
  doc.setFontSize(fs);
  lines = doc.splitTextToSize(display, maxW);
  const lineH = (fs * NOME_LINE_LEADING * 25.4) / 72;
  let y = yTop;
  lines.forEach((ln) => {
    doc.text(ln, centerX, y, { align: "center" });
    y += lineH;
  });
  return y;
}

/** Altura do bloco do nome (mesma lógica que `drawNomeClienteComChavesFit`), para centralizar verticalmente. */
function measureNomeClienteComChavesBlockHeight(
  doc: jsPDF,
  nome: string,
  maxW: number,
  maxBlockBottomY: number,
  yStart: number,
): number {
  const upper = nome.trim().toUpperCase();
  const display = upper;
  doc.setFont("helvetica", "bold");
  let fs = NOME_FS_MAX;
  let lines: string[] = [];
  for (let i = 0; i < 18; i++) {
    doc.setFontSize(fs);
    lines = doc.splitTextToSize(display, maxW);
    const lineH = (fs * NOME_LINE_LEADING * 25.4) / 72;
    const blockBottom = yStart + lines.length * lineH;
    if (blockBottom <= maxBlockBottomY && lines.length <= 5) break;
    fs = Math.max(NOME_FS_MIN, fs - 2);
  }
  doc.setFontSize(fs);
  lines = doc.splitTextToSize(display, maxW);
  const lineH = (fs * NOME_LINE_LEADING * 25.4) / 72;
  return lines.length * lineH;
}

/** Logo na base, centralizada; `dim` opcional (ex.: altura reduzida mantendo proporção). */
async function drawLogoCenteredAtY(
  doc: jsPDF,
  logoDataUrl: string | null,
  nomeProjeto: string,
  centerX: number,
  innerW: number,
  yTop: number,
  pageHeightMm: number,
  dim?: { wMm: number; hMm: number },
): Promise<number> {
  let wMm: number;
  let hMm: number;
  if (dim) {
    wMm = dim.wMm;
    hMm = dim.hMm;
  } else if (logoDataUrl) {
    try {
      const m = await computeLogoDrawMm(logoDataUrl, innerW, pageHeightMm);
      wMm = m.wMm;
      hMm = m.hMm;
    } catch {
      const fb = capLogoToPage(50 * LOGO_SCALE_FACTOR, 16 * LOGO_SCALE_FACTOR, innerW, pageHeightMm);
      wMm = fb.wMm;
      hMm = fb.hMm;
    }
  } else {
    const fb = capLogoToPage(50 * LOGO_SCALE_FACTOR, 16 * LOGO_SCALE_FACTOR, innerW, pageHeightMm);
    wMm = fb.wMm;
    hMm = fb.hMm;
  }
  if (logoDataUrl) {
    try {
      const fmt = imageFormatFromDataUrl(logoDataUrl);
      doc.addImage(logoDataUrl, fmt, centerX - wMm / 2, yTop, wMm, hMm);
      return hMm;
    } catch {
      /* fall through */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(45, 45, 45);
  doc.text(nomeProjeto.slice(0, 44), centerX, yTop + 10, { align: "center", maxWidth: innerW });
  doc.setTextColor(0, 0, 0);
  return 22;
}

async function drawLogoCentered(
  doc: jsPDF,
  logoDataUrl: string | null,
  nomeProjeto: string,
  centerX: number,
  innerW: number,
  yTop: number,
  pageHeightMm: number,
): Promise<number> {
  if (logoDataUrl) {
    try {
      const { wMm, hMm } = await computeLogoDrawMm(logoDataUrl, innerW, pageHeightMm);
      const fmt = imageFormatFromDataUrl(logoDataUrl);
      doc.addImage(logoDataUrl, fmt, centerX - wMm / 2, yTop, wMm, hMm);
      return yTop + hMm + 8;
    } catch {
      /* fallback */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(45, 45, 45);
  doc.text(nomeProjeto.slice(0, 44), centerX, yTop + 10, { align: "center", maxWidth: innerW });
  doc.setTextColor(0, 0, 0);
  return yTop + 22;
}

function estimateFooterHeightMm(f: ReceptivoFooterPayload): number {
  if (f.numeroReserva == null) return 0;
  let lines = 2 + 2;
  if (f.idaData || f.idaHora) lines += 1;
  if (f.voltaEmb || f.voltaDesemb) lines += 2;
  if (f.voltaData || f.voltaHora) lines += 1;
  return 6 + lines * 3.6 + 4;
}

export async function generateReceptivoTransferPdf(
  modelo: number,
  nomeCliente: string,
  nomeProjeto: string,
  logoUrl: string | null,
  footer: ReceptivoFooterPayload,
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const innerW = W - 2 * M_OUT;
  const logoDataUrl = logoUrl ? await loadImageDataUrl(logoUrl) : null;
  const hasTrip = footer.numeroReserva != null;
  /** Apenas modelos 1–4; valores fora do intervalo são limitados a 1–4. */
  const m = Math.min(4, Math.max(1, modelo));
  const modelo1Template = m === 1 ? await loadModelo1TemplateDataUrl() : null;
  let modelo1TemplateRendered = false;
  const modelo2Template = m === 2 ? await loadModelo2TemplateDataUrl() : null;
  let modelo2TemplateRendered = false;
  const modelo3Template = m === 3 ? await loadModelo3TemplateDataUrl() : null;
  let modelo3TemplateRendered = false;
  const modelo4Template = m === 4 ? await loadModelo4TemplateDataUrl() : null;
  let modelo4TemplateRendered = false;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, "F");
  if (m === 1) {
    if (modelo1Template) {
      try {
        doc.addImage(modelo1Template, imageFormatFromDataUrl(modelo1Template), 0, 0, W, H);
        modelo1TemplateRendered = true;
      } catch {
        drawRoundedUsefulBorder(doc, W, H);
      }
    } else {
      drawRoundedUsefulBorder(doc, W, H);
    }
  } else if (m === 2) {
    if (modelo2Template) {
      try {
        doc.addImage(modelo2Template, imageFormatFromDataUrl(modelo2Template), 0, 0, W, H);
        modelo2TemplateRendered = true;
      } catch {
        drawRoundedUsefulBorder(doc, W, H);
      }
    } else {
      drawRoundedUsefulBorder(doc, W, H);
    }
  } else if (m === 3) {
    if (modelo3Template) {
      try {
        doc.addImage(modelo3Template, imageFormatFromDataUrl(modelo3Template), 0, 0, W, H);
        modelo3TemplateRendered = true;
      } catch {
        drawOpenCornerBorder(doc, W, H);
      }
    } else {
      drawOpenCornerBorder(doc, W, H);
    }
  } else if (m === 4) {
    if (modelo4Template) {
      try {
        doc.addImage(modelo4Template, imageFormatFromDataUrl(modelo4Template), 0, 0, W, H);
        modelo4TemplateRendered = true;
      } catch {
        drawOpenCornerBorder(doc, W, H, G_CORNER_MODEL4);
      }
    } else {
      drawOpenCornerBorder(doc, W, H, G_CORNER_MODEL4);
    }
  }

  if (m === 1) {
    const contentW = innerW - 2 * M_IN;
    const bottomSafe = H - M_OUT - M_IN - 2;
    const footerH = estimateFooterHeightMm(footer);

    if (modelo1TemplateRendered) {
      const yLineMm = H * M1_TEMPLATE_LINE_Y_FRAC;
      const yAboveLine = yLineMm - 10;
      const yFooterStart = yLineMm + 6;

      let y = M1_LOGO_TOP_MM;
      y = await drawLogoCentered(doc, logoDataUrl, nomeProjeto, W / 2, contentW, y, H);
      y += LOGO_TO_NOME_GAP_MM;
      y = drawNomeClienteComChavesFit(doc, nomeCliente, W / 2, y, contentW * 0.88, yAboveLine);

      if (hasTrip) {
        let yFt = yFooterStart;
        if (yFt + footerH > bottomSafe) {
          yFt = Math.max(yLineMm + 4, bottomSafe - footerH - 2);
        }
        drawTripFooterCentered(doc, W / 2, yFt, contentW * 0.85, footer, { bracedTitle: true });
      }
    } else {
      const contentTop = M_OUT + M_IN + 8;
      let y = contentTop;
      y = await drawLogoCentered(doc, logoDataUrl, nomeProjeto, W / 2, contentW, y, H);
      y += hasTrip ? 26 : 30;
      y = drawNomeClienteComChaves(doc, nomeCliente, W / 2, y, contentW * 0.92);
      y += hasTrip ? 26 : 30;
      drawTraçoCentralComTicks(doc, W, y, innerW);
      const yAfterLine = y + 1.4 + 10;

      if (hasTrip) {
        const minY = yAfterLine + 6;
        const bottomAlignedY = bottomSafe - footerH - 2;
        let yFooterTop = Math.max(minY, bottomAlignedY);
        if (yFooterTop + footerH > bottomSafe) {
          yFooterTop = Math.max(minY, bottomSafe - footerH - 2);
        }
        drawTripFooterCentered(doc, W / 2, yFooterTop, contentW * 0.9, footer);
      }
    }
  } else if (m === 2) {
    const contentW = innerW - 2 * M_IN;
    const bottomSafe = H - M_OUT - M_IN - 2;
    const footerH = estimateFooterHeightMm(footer);

    if (modelo2TemplateRendered) {
      const yLineMm = H * M2_TEMPLATE_LINE_Y_FRAC;
      const yAboveLine = yLineMm - 10;
      const yFooterStart = yLineMm + 6;

      let y = M2_LOGO_TOP_MM;
      y = await drawLogoCentered(doc, logoDataUrl, nomeProjeto, W / 2, contentW, y, H);
      y += LOGO_TO_NOME_GAP_MM;
      y = drawNomeClienteComChavesFit(doc, nomeCliente, W / 2, y, contentW * 0.88, yAboveLine);

      if (hasTrip) {
        let yFt = yFooterStart;
        if (yFt + footerH > bottomSafe) {
          yFt = Math.max(yLineMm + 4, bottomSafe - footerH - 2);
        }
        drawTripFooterCentered(doc, W / 2, yFt, contentW * 0.85, footer, { bracedTitle: true });
      }
    } else {
      const contentTop = M_OUT + M_IN + 28;
      const gapAboveLogo = 10;
      const logoBottomMargin = 8;

      let logoW = 50;
      let logoH = 16;
      if (logoDataUrl) {
        const dims = await computeLogoDrawMm(logoDataUrl, contentW, H);
        logoW = dims.wMm;
        logoH = dims.hMm;
      }
      const logoAspect = logoW / Math.max(logoH, 0.01);
      let yLogoTop = bottomSafe - logoH - logoBottomMargin;

      const reserveAfterName = 9 + 1.4 + 10;
      const footerBlock = hasTrip ? estimateFooterHeightMm(footer) + 12 : 14;
      let maxNomeBlockBottom = yLogoTop - gapAboveLogo - reserveAfterName - footerBlock;
      if (maxNomeBlockBottom < contentTop + 28) {
        const need = contentTop + 32 - maxNomeBlockBottom;
        logoH = Math.max(LOGO_H_MIN_MM, logoH - need);
        logoW = logoH * logoAspect;
        yLogoTop = bottomSafe - logoH - logoBottomMargin;
        maxNomeBlockBottom = yLogoTop - gapAboveLogo - reserveAfterName - footerBlock;
      }

      let y = contentTop;
      y = drawNomeClienteComChavesFit(doc, nomeCliente, W / 2, y, contentW * 0.92, maxNomeBlockBottom);
      y += 9;
      drawTraçoCentralComTicks(doc, W, y, innerW);
      y += 1.4 + 10;
      if (hasTrip) {
        drawTripFooterCentered(doc, W / 2, y, contentW * 0.9, footer, { bracedTitle: true });
      }
      await drawLogoCenteredAtY(doc, logoDataUrl, nomeProjeto, W / 2, contentW, yLogoTop, H, {
        wMm: logoW,
        hMm: logoH,
      });
    }
  } else if (m === 3) {
    const contentW = innerW - 2 * M_IN;
    const bottomSafe = H - M_OUT - M_IN - 2;
    const footerH = estimateFooterHeightMm(footer);

    if (modelo3TemplateRendered) {
      const yLineMm = H * M3_TEMPLATE_LINE_Y_FRAC;
      const yAboveLine = yLineMm - 10;
      const yFooterStart = yLineMm + 6;

      let y = M3_LOGO_TOP_MM;
      y = await drawLogoCentered(doc, logoDataUrl, nomeProjeto, W / 2, contentW, y, H);
      y += LOGO_TO_NOME_GAP_MM;
      y = drawNomeClienteComChavesFit(doc, nomeCliente, W / 2, y, contentW * 0.88, yAboveLine);

      if (hasTrip) {
        let yFt = yFooterStart;
        if (yFt + footerH > bottomSafe) {
          yFt = Math.max(yLineMm + 4, bottomSafe - footerH - 2);
        }
        drawTripFooterCentered(doc, W / 2, yFt, contentW * 0.85, footer, { bracedTitle: true });
      }
    } else {
      const contentTop = M_OUT + M_IN + 28;
      let y = contentTop;
      y = await drawLogoCentered(doc, logoDataUrl, nomeProjeto, W / 2, contentW, y, H);
      y += hasTrip ? 26 : 30;
      if (hasTrip) {
        const reserveAfterNome = 9 + 1.4 + 10 + 6;
        const maxNomeBlockBottom = bottomSafe - footerH - reserveAfterNome - 4;
        y = drawNomeClienteComChavesFit(doc, nomeCliente, W / 2, y, contentW * 0.92, maxNomeBlockBottom);
      } else {
        y = drawNomeClienteComChaves(doc, nomeCliente, W / 2, y, contentW * 0.92);
      }
      y += hasTrip ? 26 : 30;
      drawTraçoCentralComTicks(doc, W, y, innerW);
      const yAfterLine = y + 1.4 + 10;

      if (hasTrip) {
        const minY = yAfterLine + 6;
        const bottomAlignedY = bottomSafe - footerH - 2;
        let yFooterTop = Math.max(minY, bottomAlignedY);
        if (yFooterTop + footerH > bottomSafe) {
          yFooterTop = Math.max(minY, bottomSafe - footerH - 2);
        }
        drawTripFooterCentered(doc, W / 2, yFooterTop, contentW * 0.9, footer, { bracedTitle: true });
      }
    }
  } else if (m === 4) {
    const contentW = innerW - 2 * M_IN;
    const bottomSafe = H - M_OUT - M_IN - 2;
    const footerH = estimateFooterHeightMm(footer);

    if (modelo4TemplateRendered) {
      const yLineMm = H * M4_TEMPLATE_LINE_Y_FRAC;
      const yAboveLine = yLineMm - 10;
      const yFooterStart = yLineMm + 6;

      let y = M4_LOGO_TOP_MM;
      y = await drawLogoCentered(doc, logoDataUrl, nomeProjeto, W / 2, contentW, y, H);
      y += LOGO_TO_NOME_GAP_MM;
      y = drawNomeClienteComChavesFit(doc, nomeCliente, W / 2, y, contentW * 0.88, yAboveLine);

      if (hasTrip) {
        let yFt = yFooterStart;
        if (yFt + footerH > bottomSafe) {
          yFt = Math.max(yLineMm + 4, bottomSafe - footerH - 2);
        }
        drawTripFooterCentered(doc, W / 2, yFt, contentW * 0.85, footer, { bracedTitle: true });
      }
    } else {
      const contentTop = M_OUT + M_IN + 16;
      let y = contentTop;
      y = await drawLogoCentered(doc, logoDataUrl, nomeProjeto, W / 2, contentW, y, H);
      const yAfterLogo = y;

      const gapAfterName = 10;
      const tickH = 1.4;
      const traçoFrac = 0.65;
      const regionStart = yAfterLogo + 32;
      const footerTop = hasTrip ? bottomSafe - footerH - 8 : bottomSafe;
      const regionEnd = hasTrip ? footerTop - 10 : bottomSafe - 12;
      const regionHeight = Math.max(24, regionEnd - regionStart);

      const maxNomeBottomY = regionEnd - gapAfterName - tickH - 2;
      let yNameStart = regionStart;
      for (let k = 0; k < 4; k++) {
        const nh = measureNomeClienteComChavesBlockHeight(
          doc,
          nomeCliente,
          contentW * 0.92,
          maxNomeBottomY,
          yNameStart,
        );
        const clusterH = nh + gapAfterName + tickH;
        const nextY = regionStart + Math.max(0, (regionHeight - clusterH) / 2);
        if (Math.abs(nextY - yNameStart) < 0.4) break;
        yNameStart = nextY;
      }

      y = drawNomeClienteComChavesFit(doc, nomeCliente, W / 2, yNameStart, contentW * 0.92, maxNomeBottomY);
      y += gapAfterName;
      drawTraçoCentralComTicks(doc, W, y, innerW, traçoFrac);

      const yAfterLine = y + tickH + 10;
      if (hasTrip) {
        const minY = yAfterLine + 6;
        const bottomAlignedY = bottomSafe - footerH - 2;
        let yFooterTop = Math.max(minY, bottomAlignedY);
        if (yFooterTop + footerH > bottomSafe) {
          yFooterTop = Math.max(minY, bottomSafe - footerH - 2);
        }
        drawTripFooterCentered(doc, W / 2, yFooterTop, contentW * 0.9, footer, { bracedTitle: true });
      }
    }
  }

  return doc;
}

export function downloadReceptivoPdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}
