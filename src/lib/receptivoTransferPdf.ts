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

/** Margem externa (~20mm). Espaço entre fim da linha da borda e o canto da página (~15mm). */
const M_OUT = 20;
const G_CORNER = 15;
const BORDER_LINE_MM = 0.35;

/** Logo: altura equivalente entre ~60px e ~90px em 96dpi → mm */
const PX96_TO_MM = 25.4 / 96;
const LOGO_H_MIN_MM = 60 * PX96_TO_MM;
const LOGO_H_MAX_MM = 90 * PX96_TO_MM;

const NOME_FS_MIN = 48;
const NOME_FS_MAX = 72;

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

function getNaturalImageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
}

/** Logo sem distorção: altura em mm entre LOGO_H_MIN e LOGO_H_MAX, largura proporcional. */
async function computeLogoDrawMm(
  logoDataUrl: string,
  innerW: number,
): Promise<{ wMm: number; hMm: number }> {
  const { w: nw, h: nh } = await getNaturalImageSize(logoDataUrl);
  if (!nh || !nw) return { wMm: 40, hMm: 18 };
  const aspect = nw / nh;
  let hMm = nh * PX96_TO_MM;
  hMm = Math.min(LOGO_H_MAX_MM, Math.max(LOGO_H_MIN_MM, hMm));
  let wMm = hMm * aspect;
  const maxW = innerW * 0.88;
  if (wMm > maxW) {
    wMm = maxW;
    hMm = wMm / aspect;
    if (hMm < LOGO_H_MIN_MM) hMm = LOGO_H_MIN_MM;
  }
  return { wMm, hMm };
}

/** Borda em 4 segmentos; cantos abertos (linhas não se encontram). */
function drawOpenCornerBorder(doc: jsPDF, W: number, H: number) {
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(BORDER_LINE_MM);
  const x0 = M_OUT + G_CORNER;
  const x1 = W - M_OUT - G_CORNER;
  const y0 = M_OUT + G_CORNER;
  const y1 = H - M_OUT - G_CORNER;
  doc.line(x0, M_OUT, x1, M_OUT);
  doc.line(x0, H - M_OUT, x1, H - M_OUT);
  doc.line(M_OUT, y0, M_OUT, y1);
  doc.line(W - M_OUT, y0, W - M_OUT, y1);
}

function pickNomeFontSize(len: number): number {
  if (len <= 14) return 72;
  if (len <= 22) return 64;
  if (len <= 34) return 56;
  if (len <= 48) return 52;
  if (len <= 62) return 48;
  return NOME_FS_MIN;
}

/** Nome centralizado, negrito, 48–72pt com redução se quebrar demais. Retorna Y após o bloco. */
function drawNomeClienteResponsivo(
  doc: jsPDF,
  nome: string,
  centerX: number,
  yTop: number,
  maxW: number,
): number {
  const upper = nome.trim().toUpperCase();
  let fs = Math.min(NOME_FS_MAX, pickNomeFontSize(upper.length));
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  let lines: string[] = [];
  for (let i = 0; i < 12; i++) {
    doc.setFontSize(fs);
    lines = doc.splitTextToSize(upper, maxW);
    const estH = lines.length * ((fs * 1.2 * 25.4) / 72);
    if (lines.length <= 3 && estH < 55) break;
    fs = Math.max(NOME_FS_MIN, fs - 3);
  }
  doc.setFontSize(fs);
  lines = doc.splitTextToSize(upper, maxW);
  const lineH = (fs * 1.22 * 25.4) / 72;
  let y = yTop;
  lines.forEach((ln) => {
    doc.text(ln, centerX, y, { align: "center" });
    y += lineH;
  });
  return y;
}

function drawTraçoCentral(doc: jsPDF, W: number, y: number, innerW: number) {
  const tw = innerW * 0.7;
  const x0 = (W - tw) / 2;
  doc.setDrawColor(35, 35, 35);
  doc.setLineWidth(BORDER_LINE_MM);
  doc.line(x0, y, x0 + tw, y);
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

async function drawLogoCentered(
  doc: jsPDF,
  logoDataUrl: string | null,
  nomeProjeto: string,
  centerX: number,
  innerW: number,
  yTop: number,
): Promise<number> {
  if (logoDataUrl) {
    try {
      const { wMm, hMm } = await computeLogoDrawMm(logoDataUrl, innerW);
      const fmt = imageFormatFromDataUrl(logoDataUrl);
      doc.addImage(logoDataUrl, fmt, centerX - wMm / 2, yTop, wMm, hMm);
      return yTop + hMm + 8;
    } catch {
      /* fallback */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(45, 45, 45);
  doc.text(nomeProjeto.slice(0, 44), centerX, yTop + 8, { align: "center", maxWidth: innerW });
  doc.setTextColor(0, 0, 0);
  return yTop + 16;
}

function footerYStart(H: number, hasFooter: boolean): number {
  return hasFooter ? H - M_OUT - 38 : H - M_OUT;
}

function drawFooterBlock(
  doc: jsPDF,
  W: number,
  H: number,
  innerW: number,
  footer: ReceptivoFooterPayload,
) {
  if (footer.numeroReserva == null) return;
  const y0 = H - M_OUT - 36;
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.25);
  doc.line(M_OUT + 2, y0 - 1, W - M_OUT - 2, y0 - 1);
  drawTripFooter(doc, M_OUT + 3, y0 + 2, innerW - 6, footer);
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
  const yContentEnd = footerYStart(H, hasTrip);
  const gapV = 7;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, "F");
  drawOpenCornerBorder(doc, W, H);

  if (modelo === 1) {
    let y = M_OUT + 10;
    y = await drawLogoCentered(doc, logoDataUrl, nomeProjeto, W / 2, innerW, y);
    y += gapV;
    drawTraçoCentral(doc, W, y, innerW);
    y += gapV + 4;
    y = drawNomeClienteResponsivo(doc, nomeCliente, W / 2, y, innerW * 0.92);
    drawFooterBlock(doc, W, H, innerW, footer);
  } else if (modelo === 2) {
    let y = M_OUT + 5;
    if (logoDataUrl) {
      try {
        const { wMm, hMm } = await computeLogoDrawMm(logoDataUrl, innerW * 0.35);
        const fmt = imageFormatFromDataUrl(logoDataUrl);
        doc.addImage(logoDataUrl, fmt, M_OUT + 4, y, wMm, hMm);
      } catch {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(nomeProjeto.slice(0, 30), M_OUT + 4, y + 6);
      }
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(nomeProjeto.slice(0, 30), M_OUT + 4, y + 6);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text("RECEPTIVO", W - M_OUT - 4, y + 8, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y = M_OUT + 28;
    drawTraçoCentral(doc, W, y, innerW);
    y += gapV + 10;
    y = drawNomeClienteResponsivo(doc, nomeCliente, W / 2, y, innerW * 0.92);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text("Apresente no embarque", M_OUT + 3, Math.min(y + 6, yContentEnd - 8));
    doc.setTextColor(0, 0, 0);
    drawFooterBlock(doc, W, H, innerW, footer);
  } else if (modelo === 3) {
    const split = M_OUT + innerW * 0.34;
    const colLeftW = split - M_OUT - 1;
    const colLeftCenter = M_OUT + colLeftW / 2;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.25);
    doc.line(split, M_OUT + G_CORNER, split, yContentEnd - G_CORNER);
    let ly = M_OUT + 8;
    ly = await drawLogoCentered(doc, logoDataUrl, nomeProjeto, colLeftCenter, colLeftW - 6, ly);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(110, 110, 110);
    doc.text("Passageiro", split + 6, M_OUT + 10);
    doc.setTextColor(0, 0, 0);
    const rightCenterX = split + (W - M_OUT - split) / 2;
    const rightMaxW = W - M_OUT - split - 10;
    let ny = M_OUT + 18;
    ny = drawNomeClienteResponsivo(doc, nomeCliente, rightCenterX, ny, rightMaxW);
    drawTraçoCentral(doc, W, Math.min(ny + 8, yContentEnd - 22), innerW);
    drawFooterBlock(doc, W, H, innerW, footer);
  } else if (modelo === 4) {
    let y = M_OUT + 12;
    y = await drawLogoCentered(doc, logoDataUrl, nomeProjeto, W / 2, innerW, y);
    y += gapV;
    drawTraçoCentral(doc, W, y, innerW);
    y += gapV + 8;
    y = drawNomeClienteResponsivo(doc, nomeCliente, W / 2, y, innerW * 0.9);
    drawFooterBlock(doc, W, H, innerW, footer);
  } else {
    let y = M_OUT + 14;
    y = await drawLogoCentered(doc, logoDataUrl, nomeProjeto, W / 2, innerW, y);
    y += gapV + 2;
    drawTraçoCentral(doc, W, y, innerW);
    y += gapV + 8;
    y = drawNomeClienteResponsivo(doc, nomeCliente, W / 2, y, innerW * 0.92);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(95, 95, 95);
    doc.text("Embarque autorizado", W / 2, Math.min(y + 5, yContentEnd - 6), { align: "center" });
    doc.setTextColor(0, 0, 0);
    drawFooterBlock(doc, W, H, innerW, footer);
  }

  return doc;
}

export function downloadReceptivoPdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}
