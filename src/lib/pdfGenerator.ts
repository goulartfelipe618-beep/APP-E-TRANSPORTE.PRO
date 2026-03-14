import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

// ─── Helpers ────────────────────────────────────────────────

const PAGE_W = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const COL_HALF = CONTENT_W / 2 - 2;

function checkPage(doc: jsPDF, y: number, needed = 20): number {
  if (y + needed > 280) { doc.addPage(); return 20; }
  return y;
}

function drawRect(doc: jsPDF, x: number, y: number, w: number, h: number, fill: string) {
  doc.setFillColor(fill);
  doc.roundedRect(x, y, w, h, 2, 2, "F");
}

function wrappedText(doc: jsPDF, text: string, x: number, y: number, maxW: number, lh: number): number {
  const lines = doc.splitTextToSize(text, maxW);
  for (const line of lines) {
    y = checkPage(doc, y, lh + 2);
    doc.text(line, x, y);
    y += lh;
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

// ─── PDF Sections ───────────────────────────────────────────

function addHeader(doc: jsPDF, cab: any, titulo: string, numReserva: number | string, reservaId: string): number {
  let y = 14;

  // Company header
  if (cab && cab.razao_social) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(cab.razao_social, MARGIN, y);
    y += 5;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    const infos: string[] = [];
    if (cab.cnpj) infos.push(`CNPJ: ${cab.cnpj}`);
    if (cab.endereco_sede) infos.push(cab.endereco_sede);
    if (infos.length) { doc.text(infos.join("  |  "), MARGIN, y); y += 3.5; }
    const infos2: string[] = [];
    if (cab.telefone) infos2.push(`Tel: ${cab.telefone}`);
    if (cab.whatsapp) infos2.push(`WhatsApp: ${cab.whatsapp}`);
    if (cab.email_oficial) infos2.push(cab.email_oficial);
    if (infos2.length) { doc.text(infos2.join("  |  "), MARGIN, y); y += 3.5; }
    if (cab.representante_legal) { doc.text(`Rep. Legal: ${cab.representante_legal}`, MARGIN, y); y += 3.5; }
    doc.setTextColor(0);
    y += 1;
    doc.setDrawColor(200);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 6;
  }

  // Title block
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(titulo, MARGIN, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text(`Reserva Nº ${numReserva}`, MARGIN, y);
  doc.text(`ID: ${reservaId.substring(0, 8).toUpperCase()}`, MARGIN + 60, y);
  y += 4.5;
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, MARGIN, y);
  doc.setTextColor(0);
  y += 8;

  return y;
}

function addInfoCard(doc: jsPDF, x: number, y: number, w: number, label: string, value: string, big = false): number {
  const h = big ? 22 : 18;
  drawRect(doc, x, y, w, h, "#f4f4f5");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(label, x + 4, y + 6);
  doc.setTextColor(0);
  doc.setFontSize(big ? 14 : 10);
  doc.setFont("helvetica", "bold");
  doc.text(value || "—", x + 4, y + (big ? 16 : 14));
  doc.setFont("helvetica", "normal");
  return y + h + 3;
}

function addTwoColumnFields(doc: jsPDF, leftFields: { l: string; v: string }[], rightFields: { l: string; v: string }[], startY: number): number {
  let y = startY;
  const maxLen = Math.max(leftFields.length, rightFields.length);

  for (let i = 0; i < maxLen; i++) {
    y = checkPage(doc, y, 6);
    doc.setFontSize(8);
    if (i < leftFields.length) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100);
      doc.text(leftFields[i].l, MARGIN, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      doc.text(leftFields[i].v || "—", MARGIN + 35, y);
    }
    if (i < rightFields.length) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100);
      doc.text(rightFields[i].l, MARGIN + COL_HALF + 4, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      doc.text(rightFields[i].v || "—", MARGIN + COL_HALF + 39, y);
    }
    y += 5.5;
  }
  return y + 3;
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = checkPage(doc, y, 12);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(title, MARGIN, y);
  y += 2;
  doc.setDrawColor(220);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;
  return y;
}

function addPriceBlock(doc: jsPDF, items: { label: string; value: string }[], total: string, startY: number): number {
  let y = checkPage(doc, startY, 35);

  // Background
  drawRect(doc, MARGIN, y - 2, CONTENT_W, 30, "#f8f9fa");

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  let iy = y + 5;
  for (const item of items) {
    doc.setTextColor(80);
    doc.text(item.label, MARGIN + 4, iy);
    doc.setTextColor(0);
    doc.text(item.value, MARGIN + 70, iy);
    iy += 5;
  }

  // Total on the right
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text("VALOR TOTAL", PAGE_W - MARGIN - 50, y + 5);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(total, PAGE_W - MARGIN - 50, y + 18);

  return y + 34;
}

function addContractText(doc: jsPDF, title: string, text: string, startY: number): number {
  let y = addSectionTitle(doc, title, startY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  y = wrappedText(doc, text, MARGIN, y, CONTENT_W, 3.8);
  doc.setTextColor(0);
  return y + 4;
}

function addFooter(doc: jsPDF, cab: any) {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.setDrawColor(220);
    doc.line(MARGIN, 285, PAGE_W - MARGIN, 285);
    const footerY = 289;
    if (cab?.email_oficial) doc.text(cab.email_oficial, MARGIN, footerY);
    doc.text(`Página ${i} de ${totalPages}`, PAGE_W / 2 - 10, footerY);
    doc.text(new Date().toLocaleDateString("pt-BR"), PAGE_W - MARGIN - 20, footerY);
    doc.setTextColor(0);
  }
}

// ─── TRANSFER PDF ───────────────────────────────────────────

export async function generateTransferPDF(reservaId: string) {
  const { data: r } = await supabase.from("reservas_transfer").select("*").eq("id", reservaId).single();
  if (!r) return;

  const [contrato, cabecalho] = await Promise.all([fetchContrato("transfer"), fetchCabecalho()]);
  const doc = new jsPDF();
  const numReserva = (r as any).numero_reserva || r.id.substring(0, 6).toUpperCase();

  let y = addHeader(doc, cabecalho, "Confirmação da Reserva", numReserva, r.id);

  // ── Service + Dates block (two columns) ──
  y = addSectionTitle(doc, "INFORMAÇÕES DO SERVIÇO", y);

  const tipoLabel: Record<string, string> = { somente_ida: "Somente Ida", ida_volta: "Ida e Volta", por_hora: "Por Hora" };
  const tipoStr = tipoLabel[r.tipo_viagem] || r.tipo_viagem;

  // Left column: service info
  const leftX = MARGIN;
  const rightX = MARGIN + COL_HALF + 4;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Transfer — ${tipoStr}`, leftX, y);
  y += 6;

  const serviceFields: { l: string; v: string }[] = [];
  if (r.ida_embarque) serviceFields.push({ l: "Embarque", v: r.ida_embarque });
  if (r.ida_desembarque) serviceFields.push({ l: "Destino", v: r.ida_desembarque });
  if (r.telefone) serviceFields.push({ l: "Tel. Suporte", v: r.telefone });
  if (r.observacoes) serviceFields.push({ l: "Observações", v: r.observacoes });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  for (const f of serviceFields) {
    y = checkPage(doc, y, 6);
    doc.setTextColor(100);
    doc.text(f.l, leftX, y);
    doc.setTextColor(0);
    doc.text(f.v || "—", leftX + 30, y);
    y += 5;
  }
  y += 4;

  // Date cards
  y = checkPage(doc, y, 30);
  const cardW = (CONTENT_W - 8) / 3;

  if (r.tipo_viagem === "somente_ida" || r.tipo_viagem === "ida_volta") {
    const dataIda = r.ida_data ? new Date(r.ida_data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).toUpperCase() : "—";
    addInfoCard(doc, leftX, y, cardW, "DATA IDA", dataIda, true);
    if (r.tipo_viagem === "ida_volta") {
      const dataVolta = r.volta_data ? new Date(r.volta_data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).toUpperCase() : "—";
      addInfoCard(doc, leftX + cardW + 4, y, cardW, "DATA VOLTA", dataVolta, true);
    }
    addInfoCard(doc, leftX + (r.tipo_viagem === "ida_volta" ? 2 : 1) * (cardW + 4), y, cardW, "PASSAGEIROS", String(r.ida_passageiros || "—"), true);
  } else if (r.tipo_viagem === "por_hora") {
    addInfoCard(doc, leftX, y, cardW, "DATA", r.por_hora_data ? new Date(r.por_hora_data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).toUpperCase() : "—", true);
    addInfoCard(doc, leftX + cardW + 4, y, cardW, "HORAS", String(r.por_hora_qtd_horas || "—"), true);
    addInfoCard(doc, leftX + 2 * (cardW + 4), y, cardW, "PASSAGEIROS", String(r.por_hora_passageiros || "—"), true);
  }
  y += 28;

  // Horários
  y = checkPage(doc, y, 10);
  doc.setFontSize(8);
  if (r.tipo_viagem !== "por_hora") {
    if (r.ida_hora) { doc.setTextColor(100); doc.text("Horário Ida:", leftX, y); doc.setTextColor(0); doc.text(r.ida_hora, leftX + 25, y); }
    if (r.tipo_viagem === "ida_volta" && r.volta_hora) { doc.text("Horário Volta:", leftX + 60, y); doc.setTextColor(0); doc.text(r.volta_hora, leftX + 85, y); }
  } else {
    if (r.por_hora_hora) { doc.setTextColor(100); doc.text("Horário:", leftX, y); doc.setTextColor(0); doc.text(r.por_hora_hora, leftX + 20, y); }
  }
  doc.setTextColor(0);
  y += 8;

  // ── Price block ──
  y = addSectionTitle(doc, "PREÇO", y);
  const priceItems = [
    { label: `Transfer ${tipoStr}`, value: `R$ ${Number(r.valor_base).toFixed(2)}` },
    { label: `Passageiros: ${r.ida_passageiros || r.por_hora_passageiros || "—"}`, value: "" },
  ];
  if (Number(r.desconto) > 0) priceItems.push({ label: `Desconto`, value: `${Number(r.desconto).toFixed(0)}%` });
  y = addPriceBlock(doc, priceItems, `R$ ${Number(r.valor_total).toFixed(2)}`, y);

  // ── Payment info ──
  y = addSectionTitle(doc, "INFORMAÇÕES SOBRE PAGAMENTO", y);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const pagamento = r.metodo_pagamento || "Não informado";
  y = wrappedText(doc, `Forma de pagamento: ${pagamento}.\nO valor será cobrado conforme acordo entre as partes.`, MARGIN, y, CONTENT_W, 4);
  y += 6;

  // ── Full details (two columns) ──
  y = addSectionTitle(doc, "DETALHES COMPLETOS DA RESERVA", y);

  const detailsLeft = [
    { l: "Nome", v: r.nome_completo },
    { l: "CPF/CNPJ", v: r.cpf_cnpj },
    { l: "Telefone", v: r.telefone },
    { l: "Email", v: r.email },
    { l: "Quem viaja", v: r.quem_viaja === "motorista" ? "Motorista" : "Eu mesmo" },
  ];

  const detailsRight = [
    { l: "Pagamento", v: r.metodo_pagamento || "—" },
    { l: "Status", v: r.status },
    { l: "Criada em", v: new Date(r.created_at).toLocaleString("pt-BR") },
  ];

  y = addTwoColumnFields(doc, detailsLeft, detailsRight, y);

  // ── IDA/VOLTA details for ida_volta ──
  if (r.tipo_viagem === "ida_volta") {
    y = checkPage(doc, y, 20);
    const voltaFields = [
      { l: "Embarque", v: r.volta_embarque || "—" },
      { l: "Desembarque", v: r.volta_desembarque || "—" },
      { l: "Passageiros", v: String(r.volta_passageiros || "—") },
      { l: "Cupom", v: r.volta_cupom || "—" },
      { l: "Mensagem", v: r.volta_mensagem || "—" },
    ];
    y = addSectionTitle(doc, "DETALHES DA VOLTA", y);
    doc.setFontSize(8);
    for (const f of voltaFields) {
      y = checkPage(doc, y, 6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100);
      doc.text(f.l, MARGIN, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      doc.text(f.v, MARGIN + 35, y);
      y += 5.5;
    }
    y += 4;
  }

  // ── Por hora extra details ──
  if (r.tipo_viagem === "por_hora") {
    y = addSectionTitle(doc, "DETALHES POR HORA", y);
    const phFields = [
      { l: "End. Início", v: r.por_hora_endereco_inicio || "—" },
      { l: "Encerramento", v: r.por_hora_ponto_encerramento || "—" },
      { l: "Itinerário", v: r.por_hora_itinerario || "—" },
      { l: "Cupom", v: r.por_hora_cupom || "—" },
    ];
    doc.setFontSize(8);
    for (const f of phFields) {
      y = checkPage(doc, y, 6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100);
      doc.text(f.l, MARGIN, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      doc.text(f.v, MARGIN + 35, y);
      y += 5.5;
    }
    y += 4;
  }

  // ── Contract text (always starts on a NEW page) ──
  if (contrato && (contrato.modelo_contrato || contrato.politica_cancelamento || contrato.clausulas_adicionais)) {
    doc.addPage();
    let cy = 20;

    // Re-add company header on contract page
    if (cabecalho && cabecalho.razao_social) {
      cy = addHeader(doc, cabecalho, "Contrato de Prestação de Serviço", numReserva, r.id);
    } else {
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Contrato de Prestação de Serviço", MARGIN, cy);
      cy += 10;
    }

    if (contrato.modelo_contrato) cy = addContractText(doc, "CONTRATO", contrato.modelo_contrato, cy);
    if (contrato.politica_cancelamento) cy = addContractText(doc, "POLÍTICA DE CANCELAMENTO", contrato.politica_cancelamento, cy);
    if (contrato.clausulas_adicionais) cy = addContractText(doc, "CLÁUSULAS ADICIONAIS", contrato.clausulas_adicionais, cy);

    // Signature area
    cy = checkPage(doc, cy, 40);
    cy += 10;
    doc.setDrawColor(0);
    doc.line(MARGIN, cy, MARGIN + 70, cy);
    doc.line(PAGE_W - MARGIN - 70, cy, PAGE_W - MARGIN, cy);
    cy += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Contratante", MARGIN + 20, cy);
    doc.text("Contratado", PAGE_W - MARGIN - 50, cy);
    cy += 4;
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(r.nome_completo, MARGIN, cy);
    if (cabecalho?.razao_social) doc.text(cabecalho.razao_social, PAGE_W - MARGIN - 70, cy);
    doc.setTextColor(0);
  }

  // ── Footer ──
  addFooter(doc, cabecalho);

  doc.save(`reserva-transfer-${numReserva}-${r.nome_completo.replace(/\s/g, "_")}.pdf`);
}

// ─── GRUPO PDF ──────────────────────────────────────────────

export async function generateGrupoPDF(reservaId: string) {
  const { data: r } = await supabase.from("reservas_grupos").select("*").eq("id", reservaId).single();
  if (!r) return;

  const [contrato, cabecalho] = await Promise.all([fetchContrato("grupos"), fetchCabecalho()]);
  const doc = new jsPDF();
  const numReserva = (r as any).numero_reserva || r.id.substring(0, 6).toUpperCase();

  let y = addHeader(doc, cabecalho, "Confirmação da Reserva", numReserva, r.id);

  // ── Service info ──
  y = addSectionTitle(doc, "INFORMAÇÕES DO SERVIÇO", y);

  const veiculoLabel: Record<string, string> = { van: "Van", micro_onibus: "Micro-ônibus", onibus: "Ônibus" };
  const veiculoStr = r.tipo_veiculo ? veiculoLabel[r.tipo_veiculo] || r.tipo_veiculo : "Não informado";

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Grupo — ${veiculoStr}`, MARGIN, y);
  y += 6;

  const serviceFields: { l: string; v: string }[] = [];
  if (r.embarque) serviceFields.push({ l: "Embarque", v: r.embarque });
  if (r.destino) serviceFields.push({ l: "Destino", v: r.destino });
  if (r.telefone_motorista) serviceFields.push({ l: "Tel. Suporte", v: r.telefone_motorista });
  if (r.observacoes_viagem) serviceFields.push({ l: "Observações", v: r.observacoes_viagem });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  for (const f of serviceFields) {
    y = checkPage(doc, y, 6);
    doc.setTextColor(100);
    doc.text(f.l, MARGIN, y);
    doc.setTextColor(0);
    doc.text(f.v || "—", MARGIN + 30, y);
    y += 5;
  }
  y += 4;

  // Date cards
  y = checkPage(doc, y, 30);
  const cardW = (CONTENT_W - 8) / 3;

  const dataIda = r.data_ida ? new Date(r.data_ida).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).toUpperCase() : "—";
  addInfoCard(doc, MARGIN, y, cardW, "DATA IDA", dataIda, true);
  if (r.data_retorno) {
    const dataRet = new Date(r.data_retorno).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).toUpperCase();
    addInfoCard(doc, MARGIN + cardW + 4, y, cardW, "DATA RETORNO", dataRet, true);
  }
  addInfoCard(doc, MARGIN + (r.data_retorno ? 2 : 1) * (cardW + 4), y, cardW, "PASSAGEIROS", String(r.num_passageiros || "—"), true);
  y += 28;

  // Horários
  y = checkPage(doc, y, 10);
  doc.setFontSize(8);
  if (r.hora_ida) { doc.setTextColor(100); doc.text("Horário Ida:", MARGIN, y); doc.setTextColor(0); doc.text(r.hora_ida, MARGIN + 25, y); }
  if (r.hora_retorno) { doc.setTextColor(100); doc.text("Horário Retorno:", MARGIN + 60, y); doc.setTextColor(0); doc.text(r.hora_retorno, MARGIN + 90, y); }
  doc.setTextColor(0);
  y += 8;

  // ── Price block ──
  y = addSectionTitle(doc, "PREÇO", y);
  const priceItems = [
    { label: `Grupo ${veiculoStr}`, value: `R$ ${Number(r.valor_base).toFixed(2)}` },
    { label: `${r.num_passageiros || "—"} passageiros`, value: "" },
  ];
  if (Number(r.desconto) > 0) priceItems.push({ label: "Desconto", value: `${Number(r.desconto).toFixed(0)}%` });
  y = addPriceBlock(doc, priceItems, `R$ ${Number(r.valor_total).toFixed(2)}`, y);

  // ── Payment info ──
  y = addSectionTitle(doc, "INFORMAÇÕES SOBRE PAGAMENTO", y);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const pagamento = r.metodo_pagamento || "Não informado";
  y = wrappedText(doc, `Forma de pagamento: ${pagamento}.\nO valor será cobrado conforme acordo entre as partes.`, MARGIN, y, CONTENT_W, 4);
  y += 6;

  // ── Full details (two columns) ──
  y = addSectionTitle(doc, "DETALHES COMPLETOS DA RESERVA", y);

  const detailsLeft = [
    { l: "Nome", v: r.nome_completo },
    { l: "CPF/CNPJ", v: r.cpf_cnpj },
    { l: "WhatsApp", v: r.whatsapp },
    { l: "Email", v: r.email },
    { l: "Passageiros", v: String(r.num_passageiros || "—") },
    { l: "Veículo", v: veiculoStr },
  ];

  const detailsRight = [
    { l: "Motorista", v: r.nome_motorista || "—" },
    { l: "Tel. Mot.", v: r.telefone_motorista || "—" },
    { l: "Pagamento", v: r.metodo_pagamento || "—" },
    { l: "Status", v: r.status },
    { l: "Cupom", v: r.cupom || "—" },
    { l: "Criada em", v: new Date(r.created_at).toLocaleString("pt-BR") },
  ];

  y = addTwoColumnFields(doc, detailsLeft, detailsRight, y);

  // ── Contract text (always starts on a NEW page) ──
  if (contrato && (contrato.modelo_contrato || contrato.politica_cancelamento || contrato.clausulas_adicionais)) {
    doc.addPage();
    let cy = 20;

    // Re-add company header on contract page
    if (cabecalho && cabecalho.razao_social) {
      cy = addHeader(doc, cabecalho, "Contrato de Prestação de Serviço", numReserva, r.id);
    } else {
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Contrato de Prestação de Serviço", MARGIN, cy);
      cy += 10;
    }

    if (contrato.modelo_contrato) cy = addContractText(doc, "CONTRATO", contrato.modelo_contrato, cy);
    if (contrato.politica_cancelamento) cy = addContractText(doc, "POLÍTICA DE CANCELAMENTO", contrato.politica_cancelamento, cy);
    if (contrato.clausulas_adicionais) cy = addContractText(doc, "CLÁUSULAS ADICIONAIS", contrato.clausulas_adicionais, cy);

    // Signature area
    cy = checkPage(doc, cy, 40);
    cy += 10;
    doc.setDrawColor(0);
    doc.line(MARGIN, cy, MARGIN + 70, cy);
    doc.line(PAGE_W - MARGIN - 70, cy, PAGE_W - MARGIN, cy);
    cy += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Contratante", MARGIN + 20, cy);
    doc.text("Contratado", PAGE_W - MARGIN - 50, cy);
    cy += 4;
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(r.nome_completo, MARGIN, cy);
    if (cabecalho?.razao_social) doc.text(cabecalho.razao_social, PAGE_W - MARGIN - 70, cy);
    doc.setTextColor(0);
  }

  // ── Footer ──
  addFooter(doc, cabecalho);

  doc.save(`reserva-grupo-${numReserva}-${r.nome_completo.replace(/\s/g, "_")}.pdf`);
}
