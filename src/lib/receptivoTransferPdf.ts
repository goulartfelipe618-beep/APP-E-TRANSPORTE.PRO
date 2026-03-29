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

export function buildFooterPayloadFromReceptivoRow(row: ReceptivoRow): ReceptivoFooterPayload {
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
      tipoLabel: "—",
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

function wrapLines(doc: jsPDF, text: string, maxW: number, fontSize: number): string[] {
  doc.setFontSize(fontSize);
  return doc.splitTextToSize(text || "—", maxW);
}

function drawTripFooter(
  doc: jsPDF,
  x: number,
  y: number,
  maxW: number,
  f: ReceptivoFooterPayload,
): number {
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Detalhes da viagem", x, y);
  let cy = y + 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const reservaTxt =
    f.numeroReserva != null ? `Reserva nº ${f.numeroReserva}  |  Tipo: ${f.tipoLabel}` : `Tipo: ${f.tipoLabel}`;
  wrapLines(doc, reservaTxt, maxW, 8).forEach((line) => {
    doc.text(line, x, cy);
    cy += 3.8;
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
    wrapLines(doc, t, maxW, 8).forEach((line) => {
      doc.text(line, x, cy);
      cy += 3.8;
    });
  });
  doc.setTextColor(0, 0, 0);
  return cy + 2;
}

function drawLogoBlock(
  doc: jsPDF,
  logoDataUrl: string | null,
  nomeProjeto: string,
  centerX: number,
  topY: number,
  maxW: number,
  maxH: number,
): number {
  if (logoDataUrl) {
    try {
      const fmt = imageFormatFromDataUrl(logoDataUrl);
      doc.addImage(logoDataUrl, fmt, centerX - maxW / 2, topY, maxW, maxH);
      return topY + maxH + 4;
    } catch {
      /* fall through */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.text(nomeProjeto.slice(0, 42), centerX, topY + 10, { align: "center", maxWidth: maxW + 20 });
  doc.setTextColor(0, 0, 0);
  return topY + 16;
}

/** Gera PDF A4 paisagem, fundo branco. modelo 1..5 */
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
  const logoDataUrl = logoUrl ? await loadImageDataUrl(logoUrl) : null;

  const M = 14;
  const footerH = 42;
  const footerTop = H - M - footerH;
  const innerW = W - 2 * M;

  const drawFooterBlock = () => {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(M, footerTop - 2, W - M, footerTop - 2);
    drawTripFooter(doc, M + 2, footerTop + 4, innerW - 4, footer);
  };

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, "F");

  if (modelo === 1) {
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.35);
    doc.rect(M, M, W - 2 * M, footerTop - M - 4);
    let y = M + 8;
    y = drawLogoBlock(doc, logoDataUrl, nomeProjeto, W / 2, y, 72, 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text(nomeCliente.toUpperCase(), W / 2, y + 6, { align: "center" });
    const lineY = y + 14;
    doc.setDrawColor(40, 40, 40);
    doc.line(M + 10, lineY, W - M - 10, lineY);
    drawFooterBlock();
  } else if (modelo === 2) {
    doc.setFillColor(242, 242, 242);
    doc.rect(0, 0, W, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text("RECEPTIVO", W - M - 2, 14, { align: "right" });
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, imageFormatFromDataUrl(logoDataUrl), M, 4, 28, 12);
      } catch {
        doc.setFontSize(10);
        doc.text(nomeProjeto.slice(0, 28), M, 13);
      }
    } else {
      doc.setFontSize(10);
      doc.text(nomeProjeto.slice(0, 28), M, 13);
    }
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(32);
    doc.text(nomeCliente.toUpperCase(), W / 2, 75, { align: "center" });
    doc.setDrawColor(200, 200, 200);
    doc.line(M + 30, 88, W - M - 30, 88);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Apresente este receptivo no embarque", W / 2, 96, { align: "center" });
    drawFooterBlock();
  } else if (modelo === 3) {
    const splitX = 62;
    doc.setDrawColor(210, 210, 210);
    doc.line(splitX, M, splitX, footerTop - 4);
    doc.setFillColor(250, 250, 250);
    doc.rect(M, M, splitX - M - 2, footerTop - M - 4, "F");
    let ly = M + 8;
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, imageFormatFromDataUrl(logoDataUrl), M + 4, ly, 44, 18);
        ly += 22;
      } catch {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(nomeProjeto.slice(0, 22), M + 4, ly + 6);
        ly += 12;
      }
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(nomeProjeto.slice(0, 24), M + 4, ly + 8);
      ly += 14;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text("Identificação do passageiro", M + 4, ly + 6);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    const lines = wrapLines(doc, nomeCliente.toUpperCase(), W - splitX - M - 8, 22);
    let ny = M + 35;
    lines.forEach((ln) => {
      doc.text(ln, splitX + 8, ny);
      ny += 9;
    });
    drawFooterBlock();
  } else if (modelo === 4) {
    doc.setDrawColor(25, 25, 25);
    doc.setLineWidth(0.45);
    doc.rect(M, M, W - 2 * M, footerTop - M - 4);
    doc.setLineWidth(0.2);
    doc.rect(M + 4, M + 4, W - 2 * M - 8, footerTop - M - 12);
    const yLogo = M + 12;
    drawLogoBlock(doc, logoDataUrl, nomeProjeto, W / 2, yLogo, 56, 22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(30);
    doc.text(nomeCliente.toUpperCase(), W / 2, (M + footerTop) / 2 + 5, { align: "center" });
    drawFooterBlock();
  } else {
    const L = 18;
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(0.5);
    doc.line(M, M, M + L, M);
    doc.line(M, M, M, M + L);
    doc.line(W - M, M, W - M - L, M);
    doc.line(W - M, M, W - M, M + L);
    doc.line(M, H - M, M + L, H - M);
    doc.line(M, H - M, M, H - M - L);
    doc.line(W - M, H - M, W - M - L, H - M);
    doc.line(W - M, H - M, W - M, H - M - L);
    drawLogoBlock(doc, logoDataUrl, nomeProjeto, W / 2, M + 10, 50, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(nomeProjeto.slice(0, 40), W / 2, M + 38, { align: "center" });
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(34);
    doc.text(nomeCliente.toUpperCase(), W / 2, 95, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text("•  Embarque autorizado  •", W / 2, 108, { align: "center" });
    doc.setTextColor(0, 0, 0);
    drawFooterBlock();
  }

  return doc;
}

export function downloadReceptivoPdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}
