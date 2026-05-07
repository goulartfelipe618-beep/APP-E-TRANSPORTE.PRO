import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { Json } from "@/integrations/supabase/types";
import { parseDadosWebhook, pickStr } from "@/lib/motoristaFromSolicitacao";
import type { MotoristaFrotaDocSignedUrls } from "@/lib/motoristaFrotaStorage";

export interface MotoristaDossierPdfInput {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  cnh: string | null;
  created_at: string;
  dados_webhook: Json | null;
  docUrls: MotoristaFrotaDocSignedUrls;
  /**
   * JWT emitido na exportação (uso único + expiração ~26h). Preferido no QR.
   * Legado: `verificacao_qr_token` (UUID permanente na linha).
   */
  verificacao_jwt?: string | null;
  /** Token da coluna `motorista_verificacao_qr_token` — apenas legado se não houver JWT. */
  verificacao_qr_token?: string | null;
  /** Origem do site (ex.: `window.location.origin`) para o URL do QR. */
  app_public_origin: string;
}

const NAVY: [number, number, number] = [26, 39, 68];
const GOLD: [number, number, number] = [201, 162, 39];
const GOLD_BG: [number, number, number] = [250, 243, 220];
const MUTED: [number, number, number] = [115, 115, 115];
const GREEN_BG: [number, number, number] = [220, 252, 231];
const GREEN_TX: [number, number, number] = [22, 101, 52];
const LINE: [number, number, number] = [226, 232, 240];

const PAGE_W = 210;
const M = 14;
const INNER_W = PAGE_W - M * 2;

function fmtCpf(raw: string | null | undefined): string {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length !== 11) return raw || "—";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
}

function reportId(createdAt: string, rowId: string): string {
  let y = "2026";
  try {
    y = String(new Date(createdAt).getFullYear());
  } catch {
    /* noop */
  }
  const tail = rowId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `MTR-${y}-${tail}`;
}

/** EXIF orientation 1–8 (JPEG); 1 = sem rotação. */
function readJpegExifOrientation(arr: Uint8Array): number {
  if (arr.byteLength < 4) return 1;
  const view = new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  if (view.getUint16(0, false) !== 0xffd8) return 1;

  let offset = 2;
  while (offset + 4 < arr.byteLength) {
    if (arr[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = arr[offset + 1]!;
    if (marker === 0xda || marker === 0xd9) break;

    const segLen = view.getUint16(offset + 2, false);
    if (segLen < 2 || offset + 2 + segLen > arr.byteLength) break;

    if (marker === 0xe1) {
      const exifStart = offset + 4;
      if (
        exifStart + 6 <= arr.byteLength &&
        arr[exifStart] === 0x45 &&
        arr[exifStart + 1] === 0x78 &&
        arr[exifStart + 2] === 0x69 &&
        arr[exifStart + 3] === 0x66 &&
        arr[exifStart + 4] === 0 &&
        arr[exifStart + 5] === 0
      ) {
        const tiff = exifStart + 6;
        const le = arr[tiff] === 0x49 && arr[tiff + 1] === 0x49;
        const be = arr[tiff] === 0x4d && arr[tiff + 1] === 0x4d;
        if (!le && !be) return 1;
        const bom = le;
        const r16 = (p: number) => view.getUint16(p, bom);
        const r32 = (p: number) => view.getUint32(p, bom);
        if (r16(tiff + 2) !== 0x002a) return 1;
        const ifd0 = tiff + r32(tiff + 4);
        if (ifd0 + 2 > arr.byteLength) return 1;
        const n = r16(ifd0);
        if (ifd0 + 2 + n * 12 > arr.byteLength) return 1;
        for (let i = 0; i < n; i++) {
          const e = ifd0 + 2 + i * 12;
          if (r16(e) === 0x0112) {
            const typ = r16(e + 2);
            const cnt = r32(e + 4);
            if (typ === 3 && cnt === 1) {
              const o = r16(e + 8);
              if (o >= 1 && o <= 8) return o;
            }
            return 1;
          }
        }
      }
    }
    offset += 2 + segLen;
  }
  return 1;
}

function decodeImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = src;
  });
}

/** Corrige orientação EXIF desenhando no canvas (jsPDF ignora EXIF no JPEG bruto). */
function orientedJpegDataUrlFromImage(img: HTMLImageElement, orientation: number): string | null {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return null;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (orientation > 4 && orientation < 9) {
    canvas.width = ih;
    canvas.height = iw;
  } else {
    canvas.width = iw;
    canvas.height = ih;
  }

  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, iw, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, iw, ih);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, ih);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, ih, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, ih, iw);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, iw);
      break;
    default:
      break;
  }

  ctx.drawImage(img, 0, 0);
  try {
    return canvas.toDataURL("image/jpeg", 0.92);
  } catch {
    return null;
  }
}

async function loadRasterForPdf(
  url: string,
): Promise<{ dataUrl: string; fmt: "JPEG" | "PNG" | "WEBP" } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("pdf")) return null;
    const buf = await res.arrayBuffer();
    const u8 = new Uint8Array(buf);

    const looksJpeg = u8[0] === 0xff && u8[1] === 0xd8;
    let orientation = 1;
    if (ct.includes("jpeg") || ct.includes("jpg") || (!ct.includes("png") && !ct.includes("webp") && looksJpeg)) {
      orientation = readJpegExifOrientation(u8);
    }

    const mime = ct.includes("png") ? "image/png" : ct.includes("webp") ? "image/webp" : "image/jpeg";
    const blob = new Blob([u8], { type: mime });
    const objUrl = URL.createObjectURL(blob);
    try {
      const img = await decodeImageElement(objUrl);
      const oriented = orientedJpegDataUrlFromImage(img, orientation);
      if (oriented) {
        return { dataUrl: oriented, fmt: "JPEG" };
      }
    } catch {
      /* fallback abaixo */
    } finally {
      URL.revokeObjectURL(objUrl);
    }

    let bin = "";
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]!);
    const b64 = btoa(bin);
    if (ct.includes("png")) return { dataUrl: `data:image/png;base64,${b64}`, fmt: "PNG" };
    if (ct.includes("webp")) return { dataUrl: `data:image/webp;base64,${b64}`, fmt: "WEBP" };
    return { dataUrl: `data:image/jpeg;base64,${b64}`, fmt: "JPEG" };
  } catch {
    return null;
  }
}

/** Marcador visível: Helvetica do PDF não suporta ●/◆ (apareciam como "%Ï"). */
function drawPdfGoldDot(doc: jsPDF, cx: number, baselineY: number) {
  doc.setFillColor(...GOLD);
  doc.circle(cx, baselineY - 1.85, 1.45, "F");
}

function ensureSpace(doc: jsPDF, y: number, need: number): number {
  if (y + need > 285) {
    doc.addPage();
    return M + 6;
  }
  return y;
}

function drawGoldBar(doc: jsPDF, y: number) {
  doc.setFillColor(...GOLD);
  doc.rect(M, y, 3, 14, "F");
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
  y = ensureSpace(doc, y, 16);
  doc.setFillColor(...GOLD);
  doc.circle(M + 4, y + 3.2, 2.2, "F");
  doc.setTextColor(...NAVY);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(title, M + 9, y + 4.5);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(M, y + 8, M + INNER_W, y + 8);
  return y + 12;
}

function fieldLine(doc: jsPDF, x: number, y: number, w: number, label: string, value: string) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(label, x, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 20);
  const lines = doc.splitTextToSize(value || "—", w);
  doc.text(lines, x, y + 3.2);
  return y + 3.2 + (Array.isArray(lines) ? lines.length * 3.8 : 3.8);
}

function statusPill(doc: jsPDF, x: number, y: number, text: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  const tw = doc.getTextWidth(text) + 5;
  doc.setFillColor(...GREEN_BG);
  doc.roundedRect(x, y - 2.5, tw, 6, 1.5, 1.5, "F");
  doc.setTextColor(...GREEN_TX);
  doc.text(text, x + 2.5, y + 1.2);
  doc.setTextColor(0, 0, 0);
}

export async function downloadMotoristaDossierPdf(input: MotoristaDossierPdfInput): Promise<void> {
  const dw = parseDadosWebhook(input.dados_webhook);
  const situacao = pickStr(dw, "situacao_frota") === "inativo" ? "inativo" : "ativo";
  const statusLabel = situacao === "ativo" ? "Ativo na frota" : "Inativo na frota";

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  let y = M;

  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const rid = reportId(input.created_at, input.id);

  drawGoldBar(doc, y);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Dossiê do Motorista", M + 6, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text("Relatório completo com dados cadastrais e documentos.", M + 6, y + 11);

  doc.setFillColor(...GOLD_BG);
  doc.roundedRect(M + INNER_W - 62, y, 62, 12, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.text(`Documento gerado em ${hoje}`, M + INNER_W - 59, y + 5);
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text(`ID do Relatório: #${rid}`, M + INNER_W - 59, y + 9.5);

  y += 20;

  const foto = input.docUrls.perfil ? await loadRasterForPdf(input.docUrls.perfil) : null;
  const box = 34;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.35);
  if (foto) {
    try {
      doc.addImage(foto.dataUrl, foto.fmt, M, y, box, box, undefined, "MEDIUM");
    } catch {
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(M, y, box, box, 2, 2, "FD");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text("Foto indisponível", M + 6, y + box / 2);
    }
  } else {
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(M, y, box, box, 2, 2, "FD");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text("Sem foto", M + 10, y + box / 2);
  }
  doc.roundedRect(M, y, box, box, 2, 2, "S");

  const colX = M + box + 8;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(input.nome || "—", colX, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  drawPdfGoldDot(doc, colX + 1.45, y + 14);
  doc.setTextColor(30, 30, 30);
  doc.text(`CPF: ${fmtCpf(input.cpf)}`, colX + 5.5, y + 14);
  drawPdfGoldDot(doc, colX + 1.45, y + 20);
  doc.text(`Telefone: ${input.telefone || "—"}`, colX + 5.5, y + 20);
  drawPdfGoldDot(doc, colX + 1.45, y + 26);
  doc.text(`E-mail: ${input.email || "—"}`, colX + 5.5, y + 26);

  y += box + 10;

  y = sectionTitle(doc, y, "Informações principais");

  const gridTop = y;
  const cellW = INNER_W / 3;
  const cellH = 14;
  const cells: { label: string; value: string; pill?: string }[] = [
    { label: "Status", value: "", pill: statusLabel },
    { label: "Cidade / UF", value: [input.cidade, input.estado].filter(Boolean).join(" / ") || "—" },
    { label: "CNH", value: input.cnh || "—" },
    { label: "Categoria CNH", value: pickStr(dw, "categoria_cnh", "categoria") || "—" },
    { label: "Validade CNH", value: pickStr(dw, "validade_cnh") ? fmtDate(pickStr(dw, "validade_cnh")) : "—" },
    { label: "IBGE município", value: pickStr(dw, "ibge_municipio_id") || "—" },
    { label: "Tipo de pagamento", value: (pickStr(dw, "tipo_pagamento") || "—").toUpperCase() },
    { label: "Telefone", value: input.telefone || "—" },
    { label: "E-mail", value: input.email || "—" },
  ];

  doc.setDrawColor(...LINE);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      const c = cells[idx];
      if (!c) continue;
      const x0 = M + col * cellW;
      const y0 = gridTop + row * cellH;
      doc.rect(x0, y0, cellW, cellH, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      drawPdfGoldDot(doc, x0 + 2.3, y0 + 5);
      doc.setTextColor(...MUTED);
      doc.text(c.label, x0 + 6, y0 + 5);
      if (c.pill) {
        statusPill(doc, x0 + 2, y0 + 9, c.pill);
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(25, 25, 25);
        const tv = doc.splitTextToSize(c.value, cellW - 4);
        doc.text(tv, x0 + 2, y0 + 11);
      }
    }
  }
  y = gridTop + 3 * cellH + 8;

  y = ensureSpace(doc, y, 70);
  y = sectionTitle(doc, y, "Dados pessoais e documentos");

  const midY = y;
  const colW = (INNER_W - 6) / 2;
  const leftX = M;
  const rightX = M + colW + 6;

  let yL = midY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("Dados pessoais", leftX, yL);
  yL += 5;
  yL = fieldLine(doc, leftX, yL, colW - 2, "Nome completo", input.nome || "—");
  yL += 1;
  yL = fieldLine(doc, leftX, yL, colW - 2, "Data de nascimento", pickStr(dw, "data_nascimento") || "—");
  yL += 1;
  yL = fieldLine(doc, leftX, yL, colW - 2, "RG", pickStr(dw, "rg") || "—");
  yL += 1;
  yL = fieldLine(doc, leftX, yL, colW - 2, "Órgão expedidor", pickStr(dw, "orgao_expedidor") || "—");
  yL += 1;
  yL = fieldLine(doc, leftX, yL, colW - 2, "CEP", pickStr(dw, "cep") || "—");
  yL += 1;
  yL = fieldLine(
    doc,
    leftX,
    yL,
    colW - 2,
    "Endereço",
    pickStr(dw, "endereco") ||
      [pickStr(dw, "logradouro"), pickStr(dw, "numero"), pickStr(dw, "bairro")].filter(Boolean).join(", ") ||
      "—",
  );
  yL += 1;
  yL = fieldLine(doc, leftX, yL, colW - 2, "E-mail", input.email || "—");
  yL += 1;
  yL = fieldLine(doc, leftX, yL, colW - 2, "Telefone", input.telefone || "—");

  let yR = midY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("Documentos", rightX, yR);
  yR += 5;
  const docRows: [string, boolean][] = [
    ["Foto de perfil", Boolean(input.docUrls.perfil)],
    ["CNH — frente", Boolean(input.docUrls.cnhFrente)],
    ["CNH — verso", Boolean(input.docUrls.cnhVerso)],
    ["Comprovante de residência", Boolean(input.docUrls.residencia)],
  ];
  doc.setFont("helvetica", "normal");
  for (const [label, ok] of docRows) {
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label, rightX, yR);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(ok ? GREEN_TX : MUTED));
    doc.text(ok ? "Anexada" : "Pendente", rightX + colW - 22, yR);
    yR += 5;
  }

  yR += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("Dados de pagamento", rightX, yR);
  yR += 5;
  doc.setDrawColor(...LINE);
  doc.roundedRect(rightX, yR, colW - 2, 18, 2, 2, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("Tipo de pagamento", rightX + 3, yR + 5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text((pickStr(dw, "tipo_pagamento") || "—").toUpperCase(), rightX + 3, yR + 9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("Chave PIX / dados", rightX + 3, yR + 13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  const pix = pickStr(dw, "pix_chave");
  doc.text(pix || "—", rightX + 3, yR + 17);

  y = Math.max(yL, yR + 22) + 6;

  y = sectionTitle(doc, y, "Informações complementares");
  doc.setDrawColor(...LINE);
  const rowH = 12;
  doc.rect(M, y, INNER_W, rowH, "S");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  const xs = [M + 2, M + 42, M + 88, M + 128, M + 158];
  doc.text("Nº CNH", xs[0], y + 4);
  doc.text("Categoria", xs[1], y + 4);
  doc.text("Validade", xs[2], y + 4);
  doc.text("IBGE", xs[3], y + 4);
  doc.text("Status", xs[4], y + 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(25, 25, 25);
  doc.text(input.cnh || "—", xs[0], y + 9);
  doc.text(pickStr(dw, "categoria_cnh", "categoria") || "—", xs[1], y + 9);
  doc.text(pickStr(dw, "validade_cnh") ? fmtDate(pickStr(dw, "validade_cnh")) : "—", xs[2], y + 9);
  doc.text(pickStr(dw, "ibge_municipio_id") || "—", xs[3], y + 9);
  statusPill(doc, xs[4], y + 7.5, statusLabel);
  y += rowH + 10;

  const origin = (input.app_public_origin || "").replace(/\/$/, "");
  const jwtGate = (input.verificacao_jwt || "").trim();
  const legacyToken = (input.verificacao_qr_token || "").trim();
  let qrUrl: string;
  if (jwtGate) {
    if (!origin) {
      throw new Error(
        "URL do painel em falta: defina VITE_MOTORISTA_VERIFICACAO_APP_ORIGIN ou VITE_APP_PUBLIC_URL com o domínio onde a app corre (não use o site de marketing).",
      );
    }
    qrUrl = `${origin}/verificar-motorista?g=${encodeURIComponent(jwtGate)}`;
  } else if (legacyToken) {
    if (!origin) {
      throw new Error(
        "URL pública do app em falta: defina VITE_APP_PUBLIC_URL no ambiente ou abra o sistema no domínio correto.",
      );
    }
    qrUrl = `${origin}/verificar-motorista/${encodeURIComponent(legacyToken)}`;
  } else {
    throw new Error("Selo de verificação em falta: tente exportar de novo.");
  }
  let hostLabel = origin.replace(/^https?:\/\//i, "");
  try {
    hostLabel = new URL(origin).hostname;
  } catch {
    /* noop */
  }

  const footerH = 32;
  y = ensureSpace(doc, y, footerH + 6);
  doc.setFillColor(...NAVY);
  doc.rect(M, y, INNER_W, footerH, "F");
  doc.setFillColor(...GOLD);
  doc.rect(M, y, 3, footerH, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Verificação de autenticidade", M + 7, y + 6.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  const authBlurb = doc.splitTextToSize(
    "Digitalize o QR com a câmara. Abre a página pública do sistema para confirmar motorista oficial do operador — sem morada nem documentos confidenciais.",
    INNER_W - 34,
  );
  doc.text(authBlurb, M + 7, y + 11);
  doc.setFontSize(5.8);
  doc.setTextColor(220, 226, 240);
  doc.text(
    jwtGate ? `Selo digital · ${hostLabel}/verificar-motorista (uso único)` : `Selo digital · ${hostLabel}/verificar-motorista/…`,
    M + 7,
    y + footerH - 3,
  );

  const qrBox = 22;
  const qrPad = (footerH - qrBox) / 2;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(M + INNER_W - qrBox - qrPad - 1, y + qrPad - 0.5, qrBox + 2, qrBox + 2, 1.2, 1.2, "F");
  const qr = await QRCode.toDataURL(qrUrl, {
    margin: 1,
    width: jwtGate ? 280 : 200,
    errorCorrectionLevel: jwtGate ? "L" : "M",
  });
  doc.addImage(qr, "PNG", M + INNER_W - qrBox - qrPad, y + qrPad, qrBox, qrBox);

  const safeName = (input.nome || "motorista")
    .replace(/[^\w\u00C0-\u024f\s-]/gi, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60);
  doc.save(`Dossie_Motorista_${safeName || "motorista"}.pdf`);
}
