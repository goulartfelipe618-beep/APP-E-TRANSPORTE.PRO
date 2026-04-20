import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { mergeCabecalhoComPerfilSeNecessario } from "@/lib/cabecalhoContratualResolve";

// ─── Layout Constants ───────────────────────────────────────
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const COL_LEFT_W = CONTENT_W / 2 - 3;
const COL_RIGHT_X = MARGIN + CONTENT_W / 2 + 3;
const COL_RIGHT_W = CONTENT_W / 2 - 3;
const FOOTER_ZONE = 22; // reserved for footer
const SAFE_BOTTOM = PAGE_H - MARGIN - FOOTER_ZONE;

// ─── Spacing tokens ─────────────────────────────────────────
const SP = {
  sectionGap: 10,      // between sections
  titleAfter: 7,       // after section title + line
  fieldRow: 5.5,       // between field rows
  cardGap: 4,          // gap between cards
  blockPad: 5,         // padding inside blocks
  paraLine: 4.2,       // paragraph line height
};

// ─── Font sizes ─────────────────────────────────────────────
const FS = {
  companyName: 13,
  companyDetail: 7.5,
  pageTitle: 16,
  sectionTitle: 10,
  subtitle: 9,
  body: 8.5,
  small: 7.5,
  cardLabel: 7,
  cardValue: 13,
  priceTotal: 17,
  footer: 7,
};

// ─── Colors ─────────────────────────────────────────────────
const CLR = {
  black: "#000000",
  dark: "#1a1a1a",
  body: "#333333",
  muted: "#666666",
  light: "#999999",
  line: "#d4d4d4",
  lineFaint: "#e5e5e5",
  cardBg: "#f4f5f7",
  priceBg: "#f0f2f5",
};

// ─── Helpers ────────────────────────────────────────────────

function checkPage(doc: jsPDF, y: number, needed = 14): number {
  if (y + needed > SAFE_BOTTOM) {
    doc.addPage();
    return MARGIN + 4;
  }
  return y;
}

function setColor(doc: jsPDF, hex: string) {
  doc.setTextColor(hex);
}

function drawRect(doc: jsPDF, x: number, y: number, w: number, h: number, fill: string, radius = 3) {
  doc.setFillColor(fill);
  doc.roundedRect(x, y, w, h, radius, radius, "F");
}

function drawLine(doc: jsPDF, x1: number, y: number, x2: number, color = CLR.line) {
  doc.setDrawColor(color);
  doc.setLineWidth(0.3);
  doc.line(x1, y, x2, y);
}

function wrappedText(doc: jsPDF, text: string, x: number, y: number, maxW: number, lh: number): number {
  if (!text) return y;
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    if (!para.trim()) { y += lh; continue; }
    const lines = doc.splitTextToSize(para.trim(), maxW);
    for (const line of lines) {
      y = checkPage(doc, y, lh + 2);
      doc.text(line, x, y);
      y += lh;
    }
  }
  return y;
}

// ─── Data fetchers ──────────────────────────────────────────

/**
 * Contrato e cabeçalho pertencem ao dono da operação (`user_id` da reserva).
 * Quem gera o PDF pode ser motorista ou outro perfil — não usar só auth.getUser().
 */
async function fetchContrato(tipo: "transfer" | "grupos", ownerUserId?: string | null) {
  let uid = ownerUserId ?? null;
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser();
    uid = user?.id ?? null;
  }
  if (!uid) return null;
  const { data } = await supabase.from("contratos").select("*").eq("user_id", uid).eq("tipo", tipo).maybeSingle();
  return data;
}

async function fetchCabecalho(ownerUserId?: string | null) {
  let uid = ownerUserId ?? null;
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser();
    uid = user?.id ?? null;
  }
  if (!uid) return null;
  const [cabRes, cfgRes] = await Promise.all([
    supabase.from("cabecalho_contratual" as any).select("*").eq("user_id", uid).maybeSingle(),
    supabase
      .from("configuracoes" as any)
      .select("nome_completo, nome_empresa, telefone, email, endereco_completo")
      .eq("user_id", uid)
      .maybeSingle(),
  ]);
  return mergeCabecalhoComPerfilSeNecessario(cabRes.data as any, cfgRes.data as any) as any;
}

// ─── Logo (informações contratuais) ─────────────────────────

type LogoPdf = { dataUrl: string; format: "PNG" | "JPEG" | "WEBP"; w: number; h: number };

function fitLogoSize(nw: number, nh: number, maxW: number, maxH: number) {
  if (!nw || !nh) return { w: maxW, h: maxH };
  const s = Math.min(maxW / nw, maxH / nh, 1);
  return { w: nw * s, h: nh * s };
}

async function loadLogoForPdf(url: string | null | undefined): Promise<LogoPdf | null> {
  if (!url?.trim()) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    const mime = blob.type || "";
    let format: "PNG" | "JPEG" | "WEBP" = "PNG";
    if (mime.includes("jpeg") || mime.includes("jpg")) format = "JPEG";
    else if (mime.includes("webp")) format = "WEBP";
    else if (mime.includes("png")) format = "PNG";
    return { dataUrl, format, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

// ─── Reusable PDF Sections ──────────────────────────────────

/** Cabeçalho institucional: fundo preto, texto claro, logo à direita (informações contratuais). */
async function addCompanyHeader(
  doc: jsPDF,
  cab: any,
  startY: number,
  trailingGap: number = SP.sectionGap,
): Promise<number> {
  if (!cab || !cab.razao_social) return startY;

  const INNER = 4;
  const LOGO_MAX_W = 36;
  const LOGO_MAX_H = 22;
  const LOGO_GAP = 5;
  const NAME_LINE = 5.5;
  const DETAIL_LINE = 4;

  const logoInfo = await loadLogoForPdf(cab.logo_contratual_url as string | undefined);
  const textMaxW = CONTENT_W - 2 * INNER - (logoInfo ? LOGO_MAX_W + LOGO_GAP : 0);

  doc.setFontSize(FS.companyName);
  doc.setFont("helvetica", "bold");
  const nameLines = doc.splitTextToSize(String(cab.razao_social), textMaxW);

  const row1: string[] = [];
  if (cab.cnpj) row1.push(`CNPJ: ${cab.cnpj}`);
  if (cab.endereco_sede) row1.push(cab.endereco_sede);
  const row2: string[] = [];
  if (cab.telefone) row2.push(`Tel: ${cab.telefone}`);
  if (cab.whatsapp) row2.push(`WhatsApp: ${cab.whatsapp}`);
  if (cab.email_oficial) row2.push(cab.email_oficial);

  doc.setFontSize(FS.companyDetail);
  doc.setFont("helvetica", "normal");
  const detailLines: string[] = [];
  if (row1.length) detailLines.push(...doc.splitTextToSize(row1.join("   •   "), textMaxW));
  if (row2.length) detailLines.push(...doc.splitTextToSize(row2.join("   •   "), textMaxW));
  if (cab.representante_legal) {
    detailLines.push(...doc.splitTextToSize(`Representante Legal: ${cab.representante_legal}`, textMaxW));
  }

  const nameBlockH = nameLines.length * NAME_LINE;
  const detailBlockH = detailLines.length * DETAIL_LINE;
  const gapNameDetail = detailLines.length ? 2 : 0;
  let headerH = INNER + nameBlockH + gapNameDetail + detailBlockH + INNER;

  if (logoInfo) {
    const { h } = fitLogoSize(logoInfo.w, logoInfo.h, LOGO_MAX_W, LOGO_MAX_H);
    headerH = Math.max(headerH, INNER + h + INNER);
  }

  const boxTop = startY;
  doc.setFillColor(0, 0, 0);
  doc.roundedRect(MARGIN, boxTop, PAGE_W - 2 * MARGIN, headerH, 2, 2, "F");

  let ty = boxTop + INNER + 4;
  doc.setFontSize(FS.companyName);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  for (const line of nameLines) {
    doc.text(line, MARGIN + INNER, ty);
    ty += NAME_LINE;
  }
  if (detailLines.length) ty += gapNameDetail;
  doc.setFontSize(FS.companyDetail);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(230, 230, 230);
  for (const line of detailLines) {
    doc.text(line, MARGIN + INNER, ty);
    ty += DETAIL_LINE;
  }

  if (logoInfo) {
    const { w: lw, h: lh } = fitLogoSize(logoInfo.w, logoInfo.h, LOGO_MAX_W, LOGO_MAX_H);
    const logoX = PAGE_W - MARGIN - INNER - lw;
    const logoY = boxTop + (headerH - lh) / 2;
    try {
      doc.addImage(logoInfo.dataUrl, logoInfo.format, logoX, logoY, lw, lh);
    } catch {
      try {
        doc.addImage(logoInfo.dataUrl, "PNG", logoX, logoY, lw, lh);
      } catch {
        /* ignora logo se formato não suportado */
      }
    }
  }

  doc.setTextColor(0, 0, 0);
  return boxTop + headerH + trailingGap;
}

/** Título do documento (Confirmação / Contrato): faixa preta largura útil, texto branco — alinhado ao cabeçalho da empresa. */
function addPageTitle(doc: jsPDF, titulo: string, numReserva: number | string, reservaId: string, startY: number): number {
  const INNER = 4;
  const TITLE_LH = 6.5;
  const META_LH = 4.2;
  const textMaxW = CONTENT_W - 2 * INNER;

  doc.setFontSize(FS.pageTitle);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(titulo, textMaxW);

  const meta1 = `Reserva Nº ${numReserva}   •   ID: ${String(reservaId).substring(0, 8).toUpperCase()}`;
  const meta2 = `Gerado em ${new Date().toLocaleString("pt-BR")}`;

  doc.setFontSize(FS.subtitle);
  doc.setFont("helvetica", "normal");
  const meta1Lines = doc.splitTextToSize(meta1, textMaxW);

  const titleH = titleLines.length * TITLE_LH;
  const metaH = meta1Lines.length * META_LH + META_LH;
  const headerH = INNER + titleH + 3 + metaH + INNER;

  const boxTop = startY;
  doc.setFillColor(0, 0, 0);
  doc.roundedRect(MARGIN, boxTop, CONTENT_W, headerH, 2, 2, "F");

  let ty = boxTop + INNER + 5;
  doc.setFontSize(FS.pageTitle);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  for (const line of titleLines) {
    doc.text(line, MARGIN + INNER, ty);
    ty += TITLE_LH;
  }
  ty += 2;
  doc.setFontSize(FS.subtitle);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(220, 220, 220);
  for (const line of meta1Lines) {
    doc.text(line, MARGIN + INNER, ty);
    ty += META_LH;
  }
  doc.text(meta2, MARGIN + INNER, ty);

  doc.setTextColor(0, 0, 0);
  return boxTop + headerH + SP.sectionGap;
}

async function addFullHeader(
  doc: jsPDF,
  cab: any,
  titulo: string,
  numReserva: number | string,
  reservaId: string,
): Promise<number> {
  let y = MARGIN;
  y = await addCompanyHeader(doc, cab, y, 0);
  y = addPageTitle(doc, titulo, numReserva, reservaId, y);
  return y;
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = checkPage(doc, y, 14);
  doc.setFontSize(FS.sectionTitle);
  doc.setFont("helvetica", "bold");
  setColor(doc, CLR.dark);
  doc.text(title, MARGIN, y);
  y += 2.5;
  drawLine(doc, MARGIN, y, PAGE_W - MARGIN, CLR.lineFaint);
  y += SP.titleAfter;
  return y;
}

function addInfoCard(doc: jsPDF, x: number, y: number, w: number, label: string, value: string): number {
  const h = 24;
  drawRect(doc, x, y, w, h, CLR.cardBg);
  doc.setFontSize(FS.cardLabel);
  doc.setFont("helvetica", "bold");
  setColor(doc, CLR.muted);
  doc.text(label, x + 5, y + 8);
  setColor(doc, CLR.dark);
  doc.setFontSize(FS.cardValue);
  doc.setFont("helvetica", "bold");
  doc.text(value || "—", x + 5, y + 18);
  doc.setFont("helvetica", "normal");
  return y + h + SP.cardGap;
}

function addFieldRows(doc: jsPDF, fields: { l: string; v: string }[], x: number, startY: number, labelW = 32): number {
  let y = startY;
  doc.setFontSize(FS.body);
  for (const f of fields) {
    y = checkPage(doc, y, SP.fieldRow + 2);
    doc.setFont("helvetica", "bold");
    setColor(doc, CLR.muted);
    doc.text(f.l, x, y);
    doc.setFont("helvetica", "normal");
    setColor(doc, CLR.body);
    const val = f.v || "—";
    const lines = doc.splitTextToSize(val, CONTENT_W - labelW - 10);
    doc.text(lines[0], x + labelW, y);
    if (lines.length > 1) {
      for (let li = 1; li < lines.length; li++) {
        y += SP.fieldRow;
        y = checkPage(doc, y, SP.fieldRow);
        doc.text(lines[li], x + labelW, y);
      }
    }
    y += SP.fieldRow;
  }
  setColor(doc, CLR.black);
  return y;
}

function addTwoColumnFields(doc: jsPDF, leftFields: { l: string; v: string }[], rightFields: { l: string; v: string }[], startY: number): number {
  let y = startY;
  const maxLen = Math.max(leftFields.length, rightFields.length);
  const labelW = 34;

  doc.setFontSize(FS.body);
  for (let i = 0; i < maxLen; i++) {
    y = checkPage(doc, y, SP.fieldRow + 2);
    if (i < leftFields.length) {
      doc.setFont("helvetica", "bold");
      setColor(doc, CLR.muted);
      doc.text(leftFields[i].l, MARGIN, y);
      doc.setFont("helvetica", "normal");
      setColor(doc, CLR.body);
      doc.text(leftFields[i].v || "—", MARGIN + labelW, y);
    }
    if (i < rightFields.length) {
      doc.setFont("helvetica", "bold");
      setColor(doc, CLR.muted);
      doc.text(rightFields[i].l, COL_RIGHT_X, y);
      doc.setFont("helvetica", "normal");
      setColor(doc, CLR.body);
      doc.text(rightFields[i].v || "—", COL_RIGHT_X + labelW, y);
    }
    y += SP.fieldRow;
  }
  setColor(doc, CLR.black);
  return y + 4;
}

function addPriceBlock(doc: jsPDF, items: { label: string; value: string }[], total: string, startY: number): number {
  const blockH = Math.max(32, 12 + items.length * 6);
  const y = checkPage(doc, startY, blockH + 4);

  drawRect(doc, MARGIN, y, CONTENT_W, blockH, CLR.priceBg, 4);

  doc.setFontSize(FS.body);
  doc.setFont("helvetica", "normal");
  let iy = y + SP.blockPad + 4;
  for (const item of items) {
    setColor(doc, CLR.muted);
    doc.text(item.label, MARGIN + 6, iy);
    if (item.value) {
      setColor(doc, CLR.body);
      doc.text(item.value, MARGIN + 75, iy);
    }
    iy += 6;
  }

  // Total aligned right
  doc.setFontSize(FS.small);
  doc.setFont("helvetica", "bold");
  setColor(doc, CLR.muted);
  doc.text("VALOR TOTAL", PAGE_W - MARGIN - 52, y + SP.blockPad + 2);
  doc.setFontSize(FS.priceTotal);
  doc.setFont("helvetica", "bold");
  setColor(doc, CLR.dark);
  doc.text(total, PAGE_W - MARGIN - 52, y + SP.blockPad + 16);

  setColor(doc, CLR.black);
  return y + blockH + SP.sectionGap;
}

function addContractText(doc: jsPDF, title: string, text: string, startY: number): number {
  let y = addSectionTitle(doc, title, startY);
  doc.setFontSize(FS.body);
  doc.setFont("helvetica", "normal");
  setColor(doc, CLR.body);
  y = wrappedText(doc, text, MARGIN, y, CONTENT_W, SP.paraLine);
  setColor(doc, CLR.black);
  return y + SP.sectionGap;
}

function addSignatureArea(doc: jsPDF, clientName: string, companyName: string | null, startY: number): number {
  let y = checkPage(doc, startY, 45);
  y += 14;
  const lineLen = 72;

  drawLine(doc, MARGIN, y, MARGIN + lineLen, CLR.dark);
  drawLine(doc, PAGE_W - MARGIN - lineLen, y, PAGE_W - MARGIN, CLR.dark);
  y += 5;

  doc.setFontSize(FS.body);
  doc.setFont("helvetica", "bold");
  setColor(doc, CLR.dark);
  doc.text("Contratante", MARGIN + lineLen / 2 - 12, y);
  doc.text("Contratado", PAGE_W - MARGIN - lineLen / 2 - 10, y);
  y += 5;

  doc.setFontSize(FS.small);
  doc.setFont("helvetica", "normal");
  setColor(doc, CLR.muted);
  doc.text(clientName, MARGIN, y);
  if (companyName) doc.text(companyName, PAGE_W - MARGIN - lineLen, y);
  setColor(doc, CLR.black);

  return y + 6;
}

function addFooter(doc: jsPDF, cab: any) {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerLineY = PAGE_H - MARGIN - 8;
    drawLine(doc, MARGIN, footerLineY, PAGE_W - MARGIN, CLR.lineFaint);
    const footerY = footerLineY + 5;
    doc.setFontSize(FS.footer);
    doc.setFont("helvetica", "normal");
    setColor(doc, CLR.light);
    if (cab?.email_oficial) doc.text(cab.email_oficial, MARGIN, footerY);
    doc.text(`Página ${i} de ${totalPages}`, PAGE_W / 2 - 12, footerY);
    doc.text(new Date().toLocaleDateString("pt-BR"), PAGE_W - MARGIN - 22, footerY);
    setColor(doc, CLR.black);
  }
}

// ─── Contract pages (shared logic) ─────────────────────────

async function addContractPages(
  doc: jsPDF,
  contrato: any,
  cabecalho: any,
  numReserva: number | string,
  reservaId: string,
  clientName: string,
) {
  if (!contrato) return;
  if (contrato.incluir_no_pdf_confirmacao === false) return;
  if (!contrato.modelo_contrato && !contrato.politica_cancelamento && !contrato.clausulas_adicionais) return;

  doc.addPage();
  let y = await addFullHeader(doc, cabecalho, "Contrato de Prestação de Serviço", numReserva, reservaId);

  if (contrato.modelo_contrato) y = addContractText(doc, "CONTRATO", contrato.modelo_contrato, y);
  if (contrato.politica_cancelamento) y = addContractText(doc, "POLÍTICA DE CANCELAMENTO", contrato.politica_cancelamento, y);
  if (contrato.clausulas_adicionais) y = addContractText(doc, "CLÁUSULAS ADICIONAIS", contrato.clausulas_adicionais, y);

  addSignatureArea(doc, clientName, cabecalho?.razao_social || null, y);
}

// ─── Horários helper ────────────────────────────────────────

function addTimeRow(doc: jsPDF, entries: { label: string; value: string }[], y: number): number {
  y = checkPage(doc, y, 8);
  doc.setFontSize(FS.body);
  let x = MARGIN;
  for (const e of entries) {
    if (!e.value) continue;
    doc.setFont("helvetica", "bold");
    setColor(doc, CLR.muted);
    doc.text(e.label, x, y);
    doc.setFont("helvetica", "normal");
    setColor(doc, CLR.body);
    doc.text(e.value, x + doc.getTextWidth(e.label) + 3, y);
    x += doc.getTextWidth(e.label) + doc.getTextWidth(e.value) + 14;
  }
  setColor(doc, CLR.black);
  return y + SP.sectionGap;
}

// ═══════════════════════════════════════════════════════════
//  TRANSFER PDF
// ═══════════════════════════════════════════════════════════

/** Documento de confirmação (mesmo do download); use para base64 no webhook. */
async function buildTransferReservaPdfDocument(reservaId: string): Promise<{ doc: jsPDF; filename: string } | null> {
  const { data: r } = await supabase.from("reservas_transfer").select("*").eq("id", reservaId).single();
  if (!r) return null;

  const ownerId = r.user_id;
  const [contrato, cabecalho] = await Promise.all([
    fetchContrato("transfer", ownerId),
    fetchCabecalho(ownerId),
  ]);
  const doc = new jsPDF();
  const numReserva = (r as any).numero_reserva || r.id.substring(0, 6).toUpperCase();
  const filename = `reserva-transfer-${numReserva}-${r.nome_completo.replace(/\s/g, "_")}.pdf`;

  // ── Page 1: Confirmation ──
  let y = await addFullHeader(doc, cabecalho, "Confirmação da Reserva", numReserva, r.id);

  // Section: Service Info
  y = addSectionTitle(doc, "INFORMAÇÕES DO SERVIÇO", y);

  const tipoLabel: Record<string, string> = { somente_ida: "Somente Ida", ida_volta: "Ida e Volta", por_hora: "Por Hora" };
  const tipoStr = tipoLabel[r.tipo_viagem] || r.tipo_viagem;

  doc.setFontSize(FS.sectionTitle);
  doc.setFont("helvetica", "bold");
  setColor(doc, CLR.dark);
  doc.text(`Transfer — ${tipoStr}`, MARGIN, y);
  y += 8;

  const serviceFields: { l: string; v: string }[] = [];
  if (r.ida_embarque) serviceFields.push({ l: "Embarque:", v: r.ida_embarque });
  if (r.ida_desembarque) serviceFields.push({ l: "Destino:", v: r.ida_desembarque });
  if (r.telefone) serviceFields.push({ l: "Tel. Suporte:", v: r.telefone });
  if (r.observacoes) serviceFields.push({ l: "Observações:", v: r.observacoes });

  y = addFieldRows(doc, serviceFields, MARGIN, y, 34);
  y += 4;

  // Date cards (3 columns)
  y = checkPage(doc, y, 32);
  const cardW = (CONTENT_W - SP.cardGap * 2) / 3;

  if (r.tipo_viagem === "somente_ida" || r.tipo_viagem === "ida_volta") {
    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).toUpperCase() : "—";
    addInfoCard(doc, MARGIN, y, cardW, "DATA IDA", fmtDate(r.ida_data));
    if (r.tipo_viagem === "ida_volta") {
      addInfoCard(doc, MARGIN + cardW + SP.cardGap, y, cardW, "DATA VOLTA", fmtDate(r.volta_data));
    }
    const passCol = r.tipo_viagem === "ida_volta" ? 2 : 1;
    addInfoCard(doc, MARGIN + passCol * (cardW + SP.cardGap), y, cardW, "PASSAGEIROS", String(r.ida_passageiros || "—"));
  } else if (r.tipo_viagem === "por_hora") {
    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).toUpperCase() : "—";
    addInfoCard(doc, MARGIN, y, cardW, "DATA", fmtDate(r.por_hora_data));
    addInfoCard(doc, MARGIN + cardW + SP.cardGap, y, cardW, "HORAS", String(r.por_hora_qtd_horas || "—"));
    addInfoCard(doc, MARGIN + 2 * (cardW + SP.cardGap), y, cardW, "PASSAGEIROS", String(r.por_hora_passageiros || "—"));
  }
  y += 24 + SP.cardGap + 2;

  // Horários
  if (r.tipo_viagem !== "por_hora") {
    const timeEntries = [];
    if (r.ida_hora) timeEntries.push({ label: "Horário Ida:", value: r.ida_hora });
    if (r.tipo_viagem === "ida_volta" && r.volta_hora) timeEntries.push({ label: "Horário Volta:", value: r.volta_hora });
    if (timeEntries.length) y = addTimeRow(doc, timeEntries, y);
  } else {
    if (r.por_hora_hora) y = addTimeRow(doc, [{ label: "Horário:", value: r.por_hora_hora }], y);
  }

  // Section: Price
  y = addSectionTitle(doc, "PREÇO", y);
  const priceItems = [
    { label: `Transfer ${tipoStr}`, value: `R$ ${Number(r.valor_base).toFixed(2)}` },
    { label: `Passageiros: ${r.ida_passageiros || r.por_hora_passageiros || "—"}`, value: "" },
  ];
  if (Number(r.desconto) > 0) priceItems.push({ label: "Desconto", value: `${Number(r.desconto).toFixed(0)}%` });
  y = addPriceBlock(doc, priceItems, `R$ ${Number(r.valor_total).toFixed(2)}`, y);

  // Section: Payment
  y = addSectionTitle(doc, "INFORMAÇÕES SOBRE PAGAMENTO", y);
  doc.setFontSize(FS.body);
  doc.setFont("helvetica", "normal");
  setColor(doc, CLR.body);
  const pagamento = r.metodo_pagamento || "Não informado";
  y = wrappedText(doc, `Forma de pagamento: ${pagamento}.\nO valor será cobrado conforme acordo entre as partes.`, MARGIN, y, CONTENT_W, SP.paraLine);
  setColor(doc, CLR.black);
  y += SP.sectionGap;

  // Section: Full details
  y = addSectionTitle(doc, "DETALHES COMPLETOS DA RESERVA", y);

  const detailsLeft = [
    { l: "Nome:", v: r.nome_completo },
    { l: "CPF/CNPJ:", v: r.cpf_cnpj },
    { l: "Telefone:", v: r.telefone },
    { l: "Email:", v: r.email },
    { l: "Quem viaja:", v: r.quem_viaja === "motorista" ? "Motorista" : "Eu mesmo" },
  ];
  const detailsRight = [
    { l: "Pagamento:", v: r.metodo_pagamento || "—" },
    { l: "Status:", v: r.status },
    { l: "Criada em:", v: new Date(r.created_at).toLocaleString("pt-BR") },
  ];
  y = addTwoColumnFields(doc, detailsLeft, detailsRight, y);

  // Ida/Volta details
  if (r.tipo_viagem === "ida_volta") {
    y = addSectionTitle(doc, "DETALHES DA VOLTA", y);
    const voltaFields = [
      { l: "Embarque:", v: r.volta_embarque || "—" },
      { l: "Desembarque:", v: r.volta_desembarque || "—" },
      { l: "Passageiros:", v: String(r.volta_passageiros || "—") },
      { l: "Cupom:", v: r.volta_cupom || "—" },
      { l: "Mensagem:", v: r.volta_mensagem || "—" },
    ];
    y = addFieldRows(doc, voltaFields, MARGIN, y, 34);
    y += 4;
  }

  // Por hora details
  if (r.tipo_viagem === "por_hora") {
    y = addSectionTitle(doc, "DETALHES POR HORA", y);
    const phFields = [
      { l: "End. Início:", v: r.por_hora_endereco_inicio || "—" },
      { l: "Encerramento:", v: r.por_hora_ponto_encerramento || "—" },
      { l: "Itinerário:", v: r.por_hora_itinerario || "—" },
      { l: "Cupom:", v: r.por_hora_cupom || "—" },
    ];
    y = addFieldRows(doc, phFields, MARGIN, y, 34);
    y += 4;
  }

  // ── Contract pages ──
  await addContractPages(doc, contrato, cabecalho, numReserva, r.id, r.nome_completo);

  // ── Footer on all pages ──
  addFooter(doc, cabecalho);

  return { doc, filename };
}

export async function generateTransferPDF(reservaId: string) {
  const built = await buildTransferReservaPdfDocument(reservaId);
  if (!built) return;
  built.doc.save(built.filename);
}

/** Base64 do PDF de confirmação (para envio no webhook Comunicar — reserva Transfer). */
export async function getTransferReservaPdfBase64(
  reservaId: string,
): Promise<{ base64: string; filename: string } | null> {
  const built = await buildTransferReservaPdfDocument(reservaId);
  if (!built) return null;
  const dataUri = built.doc.output("datauristring") as string;
  const base64 = dataUri.includes(",") ? dataUri.split(",")[1]! : dataUri;
  return { base64, filename: built.filename };
}

// ═══════════════════════════════════════════════════════════
//  GRUPO PDF
// ═══════════════════════════════════════════════════════════

async function buildGrupoReservaPdfDocument(reservaId: string): Promise<{ doc: jsPDF; filename: string } | null> {
  const { data: r } = await supabase.from("reservas_grupos").select("*").eq("id", reservaId).single();
  if (!r) return null;

  const ownerId = r.user_id;
  const [contrato, cabecalho] = await Promise.all([
    fetchContrato("grupos", ownerId),
    fetchCabecalho(ownerId),
  ]);
  const doc = new jsPDF();
  const numReserva = (r as any).numero_reserva || r.id.substring(0, 6).toUpperCase();
  const filename = `reserva-grupo-${numReserva}-${r.nome_completo.replace(/\s/g, "_")}.pdf`;

  // ── Page 1: Confirmation ──
  let y = await addFullHeader(doc, cabecalho, "Confirmação da Reserva", numReserva, r.id);

  // Section: Service Info
  y = addSectionTitle(doc, "INFORMAÇÕES DO SERVIÇO", y);

  const veiculoLabel: Record<string, string> = { van: "Van", micro_onibus: "Micro-ônibus", onibus: "Ônibus" };
  const veiculoStr = r.tipo_veiculo ? veiculoLabel[r.tipo_veiculo] || r.tipo_veiculo : "Não informado";

  doc.setFontSize(FS.sectionTitle);
  doc.setFont("helvetica", "bold");
  setColor(doc, CLR.dark);
  doc.text(`Grupo — ${veiculoStr}`, MARGIN, y);
  y += 8;

  const serviceFields: { l: string; v: string }[] = [];
  if (r.embarque) serviceFields.push({ l: "Embarque:", v: r.embarque });
  if (r.destino) serviceFields.push({ l: "Destino:", v: r.destino });
  if (r.telefone_motorista) serviceFields.push({ l: "Tel. Suporte:", v: r.telefone_motorista });
  if (r.observacoes_viagem) serviceFields.push({ l: "Observações:", v: r.observacoes_viagem });

  y = addFieldRows(doc, serviceFields, MARGIN, y, 34);
  y += 4;

  // Date cards
  y = checkPage(doc, y, 32);
  const cardW = (CONTENT_W - SP.cardGap * 2) / 3;
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).toUpperCase() : "—";

  addInfoCard(doc, MARGIN, y, cardW, "DATA IDA", fmtDate(r.data_ida));
  if (r.data_retorno) {
    addInfoCard(doc, MARGIN + cardW + SP.cardGap, y, cardW, "DATA RETORNO", fmtDate(r.data_retorno));
  }
  addInfoCard(doc, MARGIN + (r.data_retorno ? 2 : 1) * (cardW + SP.cardGap), y, cardW, "PASSAGEIROS", String(r.num_passageiros || "—"));
  y += 24 + SP.cardGap + 2;

  // Horários
  const timeEntries = [];
  if (r.hora_ida) timeEntries.push({ label: "Horário Ida:", value: r.hora_ida });
  if (r.hora_retorno) timeEntries.push({ label: "Horário Retorno:", value: r.hora_retorno });
  if (timeEntries.length) y = addTimeRow(doc, timeEntries, y);

  // Section: Price
  y = addSectionTitle(doc, "PREÇO", y);
  const priceItems = [
    { label: `Grupo ${veiculoStr}`, value: `R$ ${Number(r.valor_base).toFixed(2)}` },
    { label: `${r.num_passageiros || "—"} passageiros`, value: "" },
  ];
  if (Number(r.desconto) > 0) priceItems.push({ label: "Desconto", value: `${Number(r.desconto).toFixed(0)}%` });
  y = addPriceBlock(doc, priceItems, `R$ ${Number(r.valor_total).toFixed(2)}`, y);

  // Section: Payment
  y = addSectionTitle(doc, "INFORMAÇÕES SOBRE PAGAMENTO", y);
  doc.setFontSize(FS.body);
  doc.setFont("helvetica", "normal");
  setColor(doc, CLR.body);
  const pagamento = r.metodo_pagamento || "Não informado";
  y = wrappedText(doc, `Forma de pagamento: ${pagamento}.\nO valor será cobrado conforme acordo entre as partes.`, MARGIN, y, CONTENT_W, SP.paraLine);
  setColor(doc, CLR.black);
  y += SP.sectionGap;

  // Section: Full details
  y = addSectionTitle(doc, "DETALHES COMPLETOS DA RESERVA", y);

  const detailsLeft = [
    { l: "Nome:", v: r.nome_completo },
    { l: "CPF/CNPJ:", v: r.cpf_cnpj },
    { l: "WhatsApp:", v: r.whatsapp },
    { l: "Email:", v: r.email },
    { l: "Passageiros:", v: String(r.num_passageiros || "—") },
    { l: "Veículo:", v: veiculoStr },
  ];
  const detailsRight = [
    { l: "Motorista:", v: r.nome_motorista || "—" },
    { l: "Tel. Mot.:", v: r.telefone_motorista || "—" },
    { l: "Pagamento:", v: r.metodo_pagamento || "—" },
    { l: "Status:", v: r.status },
    { l: "Cupom:", v: r.cupom || "—" },
    { l: "Criada em:", v: new Date(r.created_at).toLocaleString("pt-BR") },
  ];
  y = addTwoColumnFields(doc, detailsLeft, detailsRight, y);

  // ── Contract pages ──
  await addContractPages(doc, contrato, cabecalho, numReserva, r.id, r.nome_completo);

  // ── Footer on all pages ──
  addFooter(doc, cabecalho);

  return { doc, filename };
}

export async function generateGrupoPDF(reservaId: string) {
  const built = await buildGrupoReservaPdfDocument(reservaId);
  if (!built) return;
  built.doc.save(built.filename);
}

/** Base64 do PDF de confirmação (para envio no webhook Comunicar — reserva Grupo). */
export async function getGrupoReservaPdfBase64(
  reservaId: string,
): Promise<{ base64: string; filename: string } | null> {
  const built = await buildGrupoReservaPdfDocument(reservaId);
  if (!built) return null;
  const dataUri = built.doc.output("datauristring") as string;
  const base64 = dataUri.includes(",") ? dataUri.split(",")[1]! : dataUri;
  return { base64, filename: built.filename };
}

// ═══════════════════════════════════════════════════════════
//  SOLICITAÇÃO TRANSFER PDF (simples — antes de converter)
// ═══════════════════════════════════════════════════════════

export async function generateSolicitacaoTransferPDF(solicitacao: Record<string, any>) {
  const cabecalho = await fetchCabecalho();
  const doc = new jsPDF();
  const s = solicitacao;

  let y = MARGIN;
  y = await addCompanyHeader(doc, cabecalho, y);

  // Title
  doc.setFontSize(FS.pageTitle);
  doc.setFont("helvetica", "bold");
  setColor(doc, CLR.dark);
  doc.text("Solicitação de Transfer", MARGIN, y);
  y += 7;
  doc.setFontSize(FS.subtitle);
  doc.setFont("helvetica", "normal");
  setColor(doc, CLR.muted);
  doc.text(`Recebida em ${new Date(s.created_at).toLocaleString("pt-BR")}`, MARGIN, y);
  y += SP.sectionGap;

  // Status badge
  doc.setFontSize(FS.body);
  doc.setFont("helvetica", "bold");
  setColor(doc, CLR.dark);
  doc.text(`Status: ${s.status?.toUpperCase() || "PENDENTE"}`, MARGIN, y);
  y += SP.sectionGap;

  // Client data
  y = addSectionTitle(doc, "DADOS DO CLIENTE", y);
  const clientFields = [
    { l: "Nome:", v: s.nome_cliente || "—" },
    { l: "Contato:", v: s.contato || "—" },
    { l: "Email:", v: s.email || "—" },
  ];
  y = addFieldRows(doc, clientFields, MARGIN, y, 28);
  y += 4;

  // Trip details
  const tipoLabel: Record<string, string> = { somente_ida: "Somente Ida", ida_volta: "Ida e Volta", por_hora: "Por Hora" };
  y = addSectionTitle(doc, "DETALHES DA VIAGEM", y);

  if (s.tipo !== "por_hora") {
    const tripFields = [
      { l: "Tipo:", v: tipoLabel[s.tipo] || s.tipo || "—" },
      { l: "Embarque:", v: s.embarque || "—" },
      { l: "Desembarque:", v: s.desembarque || "—" },
      { l: "Data:", v: s.data_viagem ? new Date(s.data_viagem).toLocaleDateString("pt-BR") : "—" },
      { l: "Hora:", v: s.hora_viagem || "—" },
      { l: "Passageiros:", v: s.num_passageiros?.toString() || "—" },
      { l: "Cupom:", v: s.cupom || "—" },
    ];
    y = addFieldRows(doc, tripFields, MARGIN, y, 28);
  } else {
    const phFields = [
      { l: "Tipo:", v: "Por Hora" },
      { l: "End. Início:", v: s.por_hora_endereco_inicio || "—" },
      { l: "Encerramento:", v: s.por_hora_ponto_encerramento || "—" },
      { l: "Data:", v: s.por_hora_data ? new Date(s.por_hora_data).toLocaleDateString("pt-BR") : "—" },
      { l: "Hora:", v: s.por_hora_hora || "—" },
      { l: "Passageiros:", v: s.por_hora_passageiros?.toString() || "—" },
      { l: "Qtd. Horas:", v: s.por_hora_qtd_horas?.toString() || "—" },
      { l: "Cupom:", v: s.por_hora_cupom || "—" },
    ];
    y = addFieldRows(doc, phFields, MARGIN, y, 28);
  }
  y += 4;

  // Volta (if ida_volta)
  if (s.tipo === "ida_volta") {
    y = addSectionTitle(doc, "DADOS DA VOLTA", y);
    const voltaFields = [
      { l: "Embarque:", v: s.volta_embarque || "—" },
      { l: "Desembarque:", v: s.volta_desembarque || "—" },
      { l: "Data:", v: s.volta_data ? new Date(s.volta_data).toLocaleDateString("pt-BR") : "—" },
      { l: "Hora:", v: s.volta_hora || "—" },
      { l: "Passageiros:", v: s.volta_passageiros?.toString() || "—" },
      { l: "Cupom:", v: s.volta_cupom || "—" },
    ];
    y = addFieldRows(doc, voltaFields, MARGIN, y, 28);
    y += 4;
  }

  // Message
  if (s.mensagem) {
    y = addSectionTitle(doc, "MENSAGEM", y);
    doc.setFontSize(FS.body);
    doc.setFont("helvetica", "normal");
    setColor(doc, CLR.body);
    y = wrappedText(doc, s.mensagem, MARGIN, y, CONTENT_W, SP.paraLine);
    y += SP.sectionGap;
  }

  addFooter(doc, cabecalho);
  doc.save(`solicitacao-transfer-${s.nome_cliente?.replace(/\s/g, "_") || "sem-nome"}.pdf`);
}

// ═══════════════════════════════════════════════════════════
//  SOLICITAÇÃO GRUPO PDF (simples — antes de converter)
// ═══════════════════════════════════════════════════════════

export async function generateSolicitacaoGrupoPDF(solicitacao: Record<string, any>) {
  const cabecalho = await fetchCabecalho();
  const doc = new jsPDF();
  const s = solicitacao;

  let y = MARGIN;
  y = await addCompanyHeader(doc, cabecalho, y);

  doc.setFontSize(FS.pageTitle);
  doc.setFont("helvetica", "bold");
  setColor(doc, CLR.dark);
  doc.text("Solicitação de Grupo", MARGIN, y);
  y += 7;
  doc.setFontSize(FS.subtitle);
  doc.setFont("helvetica", "normal");
  setColor(doc, CLR.muted);
  doc.text(`Recebida em ${new Date(s.created_at).toLocaleString("pt-BR")}`, MARGIN, y);
  y += SP.sectionGap;

  doc.setFontSize(FS.body);
  doc.setFont("helvetica", "bold");
  setColor(doc, CLR.dark);
  doc.text(`Status: ${s.status?.toUpperCase() || "PENDENTE"}`, MARGIN, y);
  y += SP.sectionGap;

  y = addSectionTitle(doc, "DADOS DO CLIENTE", y);
  y = addFieldRows(doc, [
    { l: "Nome:", v: s.nome_cliente || "—" },
    { l: "WhatsApp:", v: s.whatsapp || "—" },
    { l: "Email:", v: s.email || "—" },
  ], MARGIN, y, 28);
  y += 4;

  y = addSectionTitle(doc, "DETALHES DA VIAGEM", y);
  const veiculoLabel: Record<string, string> = { van: "Van", micro_onibus: "Micro-ônibus", onibus: "Ônibus" };
  y = addFieldRows(doc, [
    { l: "Veículo:", v: veiculoLabel[s.tipo_veiculo] || s.tipo_veiculo || "—" },
    { l: "Passageiros:", v: s.num_passageiros?.toString() || "—" },
    { l: "Embarque:", v: s.embarque || "—" },
    { l: "Destino:", v: s.destino || "—" },
    { l: "Data Ida:", v: s.data_ida ? new Date(s.data_ida).toLocaleDateString("pt-BR") : "—" },
    { l: "Hora Ida:", v: s.hora_ida || "—" },
    { l: "Data Retorno:", v: s.data_retorno ? new Date(s.data_retorno).toLocaleDateString("pt-BR") : "—" },
    { l: "Hora Retorno:", v: s.hora_retorno || "—" },
    { l: "Cupom:", v: s.cupom || "—" },
  ], MARGIN, y, 32);
  y += 4;

  if (s.mensagem) {
    y = addSectionTitle(doc, "MENSAGEM", y);
    doc.setFontSize(FS.body);
    doc.setFont("helvetica", "normal");
    setColor(doc, CLR.body);
    y = wrappedText(doc, s.mensagem, MARGIN, y, CONTENT_W, SP.paraLine);
  }

  addFooter(doc, cabecalho);
  doc.save(`solicitacao-grupo-${s.nome_cliente?.replace(/\s/g, "_") || "sem-nome"}.pdf`);
}

// ═══════════════════════════════════════════════════════════
//  SOLICITAÇÃO MOTORISTA PDF (simples)
// ═══════════════════════════════════════════════════════════

export async function generateSolicitacaoMotoristaPDF(solicitacao: Record<string, any>) {
  const cabecalho = await fetchCabecalho();
  const doc = new jsPDF();
  const s = solicitacao;

  let y = MARGIN;
  y = await addCompanyHeader(doc, cabecalho, y);

  doc.setFontSize(FS.pageTitle);
  doc.setFont("helvetica", "bold");
  setColor(doc, CLR.dark);
  doc.text("Solicitação de Motorista", MARGIN, y);
  y += 7;
  doc.setFontSize(FS.subtitle);
  doc.setFont("helvetica", "normal");
  setColor(doc, CLR.muted);
  doc.text(`Recebida em ${new Date(s.created_at).toLocaleString("pt-BR")}`, MARGIN, y);
  y += SP.sectionGap;

  doc.setFontSize(FS.body);
  doc.setFont("helvetica", "bold");
  setColor(doc, CLR.dark);
  doc.text(`Status: ${s.status?.toUpperCase() || "PENDENTE"}`, MARGIN, y);
  y += SP.sectionGap;

  y = addSectionTitle(doc, "DADOS DO MOTORISTA", y);
  y = addFieldRows(doc, [
    { l: "Nome:", v: s.nome || "—" },
    { l: "Email:", v: s.email || "—" },
    { l: "Telefone:", v: s.telefone || "—" },
    { l: "CPF:", v: s.cpf || "—" },
    { l: "CNH:", v: s.cnh || "—" },
    { l: "Cidade:", v: s.cidade || "—" },
  ], MARGIN, y, 24);
  y += 4;

  if (s.mensagem) {
    y = addSectionTitle(doc, "MENSAGEM", y);
    doc.setFontSize(FS.body);
    doc.setFont("helvetica", "normal");
    setColor(doc, CLR.body);
    y = wrappedText(doc, s.mensagem, MARGIN, y, CONTENT_W, SP.paraLine);
  }

  addFooter(doc, cabecalho);
  doc.save(`solicitacao-motorista-${s.nome?.replace(/\s/g, "_") || "sem-nome"}.pdf`);
}

