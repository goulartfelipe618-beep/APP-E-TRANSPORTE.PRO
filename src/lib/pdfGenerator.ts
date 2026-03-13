import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

interface Field {
  label: string;
  value: string | number | null | undefined;
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  for (const line of lines) {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

function addSection(doc: jsPDF, title: string, fields: Field[], startY: number): number {
  let y = startY;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  if (y > 265) { doc.addPage(); y = 20; }
  doc.text(title, 14, y);
  y += 2;
  doc.setDrawColor(200);
  doc.line(14, y, 196, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  for (const f of fields) {
    if (y > 275) { doc.addPage(); y = 20; }
    const val = f.value != null && f.value !== "" ? String(f.value) : "—";
    doc.setFont("helvetica", "bold");
    doc.text(`${f.label}:`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(val, 60, y);
    y += 5.5;
  }
  return y + 4;
}

function addContractSection(doc: jsPDF, title: string, text: string, startY: number): number {
  let y = startY;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  if (y > 265) { doc.addPage(); y = 20; }
  doc.text(title, 14, y);
  y += 2;
  doc.setDrawColor(200);
  doc.line(14, y, 196, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  y = addWrappedText(doc, text, 14, y, 180, 4);
  return y + 6;
}

async function fetchContrato(tipo: "transfer" | "grupos") {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("contratos").select("*").eq("user_id", user.id).eq("tipo", tipo).maybeSingle();
  return data;
}

export async function generateTransferPDF(reservaId: string) {
  const { data: r } = await supabase.from("reservas_transfer").select("*").eq("id", reservaId).single();
  if (!r) return;

  const contrato = await fetchContrato("transfer");
  const doc = new jsPDF();

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("CONFIRMAÇÃO DE RESERVA — TRANSFER", 14, 20);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 26);
  doc.setTextColor(0);

  let y = 34;

  // Client info
  y = addSection(doc, "DADOS DO CLIENTE", [
    { label: "Nome", value: r.nome_completo },
    { label: "CPF/CNPJ", value: r.cpf_cnpj },
    { label: "Email", value: r.email },
    { label: "Telefone", value: r.telefone },
    { label: "Quem viaja", value: r.quem_viaja === "motorista" ? "Motorista" : "Eu mesmo" },
  ], y);

  // Trip details
  const tipoLabel: Record<string, string> = { somente_ida: "Somente Ida", ida_volta: "Ida e Volta", por_hora: "Por Hora" };
  y = addSection(doc, "DETALHES DA VIAGEM", [
    { label: "Tipo", value: tipoLabel[r.tipo_viagem] || r.tipo_viagem },
  ], y);

  if (r.tipo_viagem === "somente_ida" || r.tipo_viagem === "ida_volta") {
    y = addSection(doc, "→ IDA", [
      { label: "Embarque", value: r.ida_embarque },
      { label: "Desembarque", value: r.ida_desembarque },
      { label: "Data", value: r.ida_data ? new Date(r.ida_data).toLocaleDateString("pt-BR") : null },
      { label: "Hora", value: r.ida_hora },
      { label: "Passageiros", value: r.ida_passageiros },
      { label: "Cupom", value: r.ida_cupom },
      { label: "Mensagem", value: r.ida_mensagem },
    ], y);
  }

  if (r.tipo_viagem === "ida_volta") {
    y = addSection(doc, "← VOLTA", [
      { label: "Embarque", value: r.volta_embarque },
      { label: "Desembarque", value: r.volta_desembarque },
      { label: "Data", value: r.volta_data ? new Date(r.volta_data).toLocaleDateString("pt-BR") : null },
      { label: "Hora", value: r.volta_hora },
      { label: "Passageiros", value: r.volta_passageiros },
      { label: "Cupom", value: r.volta_cupom },
      { label: "Mensagem", value: r.volta_mensagem },
    ], y);
  }

  if (r.tipo_viagem === "por_hora") {
    y = addSection(doc, "⏱ POR HORA", [
      { label: "Endereço Início", value: r.por_hora_endereco_inicio },
      { label: "Ponto Encerramento", value: r.por_hora_ponto_encerramento },
      { label: "Data", value: r.por_hora_data ? new Date(r.por_hora_data).toLocaleDateString("pt-BR") : null },
      { label: "Hora", value: r.por_hora_hora },
      { label: "Passageiros", value: r.por_hora_passageiros },
      { label: "Qtd. Horas", value: r.por_hora_qtd_horas },
      { label: "Cupom", value: r.por_hora_cupom },
      { label: "Itinerário", value: r.por_hora_itinerario },
    ], y);
  }

  // Values
  y = addSection(doc, "VALORES E PAGAMENTO", [
    { label: "Valor Base", value: `R$ ${Number(r.valor_base).toFixed(2)}` },
    { label: "Desconto", value: `${Number(r.desconto).toFixed(0)}%` },
    { label: "Valor Total", value: `R$ ${Number(r.valor_total).toFixed(2)}` },
    { label: "Pagamento", value: r.metodo_pagamento },
  ], y);

  if (r.observacoes) {
    y = addSection(doc, "OBSERVAÇÕES", [
      { label: "Obs", value: r.observacoes },
    ], y);
  }

  y = addSection(doc, "STATUS", [
    { label: "Status", value: r.status },
    { label: "Criada em", value: new Date(r.created_at).toLocaleString("pt-BR") },
  ], y);

  // Contract
  if (contrato) {
    y += 4;
    if (contrato.modelo_contrato) y = addContractSection(doc, "CONTRATO", contrato.modelo_contrato, y);
    if (contrato.politica_cancelamento) y = addContractSection(doc, "POLÍTICA DE CANCELAMENTO", contrato.politica_cancelamento, y);
    if (contrato.clausulas_adicionais) y = addContractSection(doc, "CLÁUSULAS ADICIONAIS", contrato.clausulas_adicionais, y);
  }

  doc.save(`reserva-transfer-${r.nome_completo.replace(/\s/g, "_")}.pdf`);
}

export async function generateGrupoPDF(reservaId: string) {
  const { data: r } = await supabase.from("reservas_grupos").select("*").eq("id", reservaId).single();
  if (!r) return;

  const contrato = await fetchContrato("grupos");
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("CONFIRMAÇÃO DE RESERVA — GRUPO", 14, 20);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 26);
  doc.setTextColor(0);

  let y = 34;

  y = addSection(doc, "DADOS DO CLIENTE", [
    { label: "Nome", value: r.nome_completo },
    { label: "CPF/CNPJ", value: r.cpf_cnpj },
    { label: "Email", value: r.email },
    { label: "WhatsApp", value: r.whatsapp },
  ], y);

  const veiculoLabel: Record<string, string> = { van: "Van", micro_onibus: "Micro-ônibus", onibus: "Ônibus" };

  y = addSection(doc, "DETALHES DA VIAGEM", [
    { label: "Tipo Veículo", value: r.tipo_veiculo ? veiculoLabel[r.tipo_veiculo] || r.tipo_veiculo : null },
    { label: "Passageiros", value: r.num_passageiros },
    { label: "Embarque", value: r.embarque },
    { label: "Destino", value: r.destino },
    { label: "Data Ida", value: r.data_ida ? new Date(r.data_ida).toLocaleDateString("pt-BR") : null },
    { label: "Hora Ida", value: r.hora_ida },
    { label: "Data Retorno", value: r.data_retorno ? new Date(r.data_retorno).toLocaleDateString("pt-BR") : null },
    { label: "Hora Retorno", value: r.hora_retorno },
    { label: "Cupom", value: r.cupom },
  ], y);

  if (r.observacoes_viagem) {
    y = addSection(doc, "OBSERVAÇÕES DA VIAGEM", [
      { label: "Obs", value: r.observacoes_viagem },
    ], y);
  }

  y = addSection(doc, "MOTORISTA", [
    { label: "Nome", value: r.nome_motorista },
    { label: "Telefone", value: r.telefone_motorista },
  ], y);

  y = addSection(doc, "VALORES E PAGAMENTO", [
    { label: "Valor Base", value: `R$ ${Number(r.valor_base).toFixed(2)}` },
    { label: "Desconto", value: `${Number(r.desconto).toFixed(0)}%` },
    { label: "Valor Total", value: `R$ ${Number(r.valor_total).toFixed(2)}` },
    { label: "Pagamento", value: r.metodo_pagamento },
  ], y);

  y = addSection(doc, "STATUS", [
    { label: "Status", value: r.status },
    { label: "Criada em", value: new Date(r.created_at).toLocaleString("pt-BR") },
  ], y);

  if (contrato) {
    y += 4;
    if (contrato.modelo_contrato) y = addContractSection(doc, "CONTRATO", contrato.modelo_contrato, y);
    if (contrato.politica_cancelamento) y = addContractSection(doc, "POLÍTICA DE CANCELAMENTO", contrato.politica_cancelamento, y);
    if (contrato.clausulas_adicionais) y = addContractSection(doc, "CLÁUSULAS ADICIONAIS", contrato.clausulas_adicionais, y);
  }

  doc.save(`reserva-grupo-${r.nome_completo.replace(/\s/g, "_")}.pdf`);
}
