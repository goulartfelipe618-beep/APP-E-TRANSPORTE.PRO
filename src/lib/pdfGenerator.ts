import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

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

async function fetchContrato(tipo: "transfer" | "grupos") {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("contratos").select("*").eq("user_id", user.id).eq("tipo", tipo).maybeSingle();
  return data;
}

async function fetchCabecalho() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("cabecalho_contratual" as any).select("*").eq("user_id", user.id).maybeSingle();
  return data as any;
}

// ─── Reusable PDF Sections ──────────────────────────────────

function addCompanyHeader(doc: jsPDF, cab: any, startY: number): number {
  if (!cab || !cab.razao_social) return startY;
  let y = startY;

  doc.setFontSize(FS.companyName);
  doc.setFont("helvetica", "bold");
  setColor(doc, CLR.dark);
  doc.text(cab.razao_social, MARGIN, y);
  y += 6;

  doc.setFontSize(FS.companyDetail);
  doc.setFont("helvetica", "normal");
  setColor(doc, CLR.muted);

  const row1: string[] = [];
  if (cab.cnpj) row1.push(`CNPJ: ${cab.cnpj}`);
  if (cab.endereco_sede) row1.push(cab.endereco_sede);
  if (row1.length) { doc.text(row1.join("   •   "), MARGIN, y); y += 4; }

  const row2: string[] = [];
  if (cab.telefone) row2.push(`Tel: ${cab.telefone}`);
  if (cab.whatsapp) row2.push(`WhatsApp: ${cab.whatsapp}`);
  if (cab.email_oficial) row2.push(cab.email_oficial);
  if (row2.length) { doc.text(row2.join("   •   "), MARGIN, y); y += 4; }

  if (cab.representante_legal) {
    doc.text(`Representante Legal: ${cab.representante_legal}`, MARGIN, y);
    y += 4;
  }

  setColor(doc, CLR.black);
  y += 2;
  drawLine(doc, MARGIN, y, PAGE_W - MARGIN, CLR.line);
  y += SP.sectionGap;

  return y;
}

function addPageTitle(doc: jsPDF, titulo: string, numReserva: number | string, reservaId: string, y: number): number {
  doc.setFontSize(FS.pageTitle);
  doc.setFont("helvetica", "bold");
  setColor(doc, CLR.dark);
  doc.text(titulo, MARGIN, y);
  y += 8;

  doc.setFontSize(FS.subtitle);
  doc.setFont("helvetica", "normal");
  setColor(doc, CLR.muted);
  doc.text(`Reserva Nº ${numReserva}`, MARGIN, y);
  const idText = `ID: ${String(reservaId).substring(0, 8).toUpperCase()}`;
  doc.text(idText, MARGIN + 65, y);
  y += 5;
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, MARGIN, y);
  setColor(doc, CLR.black);
  y += SP.sectionGap;

  return y;
}

function addFullHeader(doc: jsPDF, cab: any, titulo: string, numReserva: number | string, reservaId: string): number {
  let y = MARGIN;
  y = addCompanyHeader(doc, cab, y);
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
  let y = checkPage(doc, startY, blockH + 4);

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

function addContractPages(
  doc: jsPDF, contrato: any, cabecalho: any,
  numReserva: number | string, reservaId: string, clientName: string
) {
  if (!contrato || (!contrato.modelo_contrato && !contrato.politica_cancelamento && !contrato.clausulas_adicionais)) return;

  doc.addPage();
  let y = addFullHeader(doc, cabecalho, "Contrato de Prestação de Serviço", numReserva, reservaId);

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

export async function generateTransferPDF(reservaId: string) {
  const { data: r } = await supabase.from("reservas_transfer").select("*").eq("id", reservaId).single();
  if (!r) return;

  const [contrato, cabecalho] = await Promise.all([fetchContrato("transfer"), fetchCabecalho()]);
  const doc = new jsPDF();
  const numReserva = (r as any).numero_reserva || r.id.substring(0, 6).toUpperCase();

  // ── Page 1: Confirmation ──
  let y = addFullHeader(doc, cabecalho, "Confirmação da Reserva", numReserva, r.id);

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
  addContractPages(doc, contrato, cabecalho, numReserva, r.id, r.nome_completo);

  // ── Footer on all pages ──
  addFooter(doc, cabecalho);

  doc.save(`reserva-transfer-${numReserva}-${r.nome_completo.replace(/\s/g, "_")}.pdf`);
}

// ═══════════════════════════════════════════════════════════
//  GRUPO PDF
// ═══════════════════════════════════════════════════════════

export async function generateGrupoPDF(reservaId: string) {
  const { data: r } = await supabase.from("reservas_grupos").select("*").eq("id", reservaId).single();
  if (!r) return;

  const [contrato, cabecalho] = await Promise.all([fetchContrato("grupos"), fetchCabecalho()]);
  const doc = new jsPDF();
  const numReserva = (r as any).numero_reserva || r.id.substring(0, 6).toUpperCase();

  // ── Page 1: Confirmation ──
  let y = addFullHeader(doc, cabecalho, "Confirmação da Reserva", numReserva, r.id);

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
  addContractPages(doc, contrato, cabecalho, numReserva, r.id, r.nome_completo);

  // ── Footer on all pages ──
  addFooter(doc, cabecalho);

  doc.save(`reserva-grupo-${numReserva}-${r.nome_completo.replace(/\s/g, "_")}.pdf`);
}
