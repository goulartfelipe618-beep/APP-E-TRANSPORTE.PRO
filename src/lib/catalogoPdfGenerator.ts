import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import type {
  CatalogoConfig,
  CatalogoServicoDestaque,
  CatalogoComodidade,
  CatalogoTema,
} from "@/hooks/useCatalogoConfig";

// ─── Página A4 paisagem ─────────────────────────────────────
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

type Palette = {
  bg: string;
  bgSoft: string;
  surface: string;
  surfaceAlt: string;
  line: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
};

const PALETTES: Record<CatalogoTema, Palette> = {
  dark: {
    bg: "#0B0B0C",
    bgSoft: "#141416",
    surface: "#1B1C1F",
    surfaceAlt: "#24262B",
    line: "#2C2F35",
    textPrimary: "#FFFFFF",
    textSecondary: "#D9DBDF",
    textMuted: "#8A8F98",
  },
  graphite: {
    bg: "#15181C",
    bgSoft: "#1E2227",
    surface: "#262B31",
    surfaceAlt: "#2F353C",
    line: "#3A4049",
    textPrimary: "#F5F6F8",
    textSecondary: "#C9CED5",
    textMuted: "#8C929B",
  },
  noir: {
    bg: "#000000",
    bgSoft: "#0A0A0A",
    surface: "#141414",
    surfaceAlt: "#1C1C1C",
    line: "#242424",
    textPrimary: "#FFFFFF",
    textSecondary: "#CFCFCF",
    textMuted: "#808080",
  },
  midnight: {
    bg: "#0A1020",
    bgSoft: "#0F1830",
    surface: "#162041",
    surfaceAlt: "#1D294F",
    line: "#2A3766",
    textPrimary: "#FFFFFF",
    textSecondary: "#CCD3E8",
    textMuted: "#8690B0",
  },
};

export interface CatalogoDadosSistema {
  nome_projeto: string;
  nome_completo: string | null;
  logo_url: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  endereco_completo: string | null;
  veiculos: Array<{
    id: string;
    marca: string;
    modelo: string;
    ano: string | null;
    tipo_veiculo: string | null;
    cor: string | null;
    imagem_capa_url: string | null;
  }>;
}

export async function fetchCatalogoDadosSistema(): Promise<CatalogoDadosSistema> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Sem sessão");

  const [{ data: cfg }, { data: veiculos }] = await Promise.all([
    supabase
      .from("configuracoes")
      .select(
        "nome_projeto, nome_completo, logo_url, telefone, email, cidade, estado, endereco_completo",
      )
      .eq("user_id", uid)
      .maybeSingle(),
    supabase
      .from("veiculos_frota")
      .select("id, marca, modelo, ano, tipo_veiculo, cor, imagem_capa_url, status")
      .eq("user_id", uid)
      .order("created_at", { ascending: false }),
  ]);

  return {
    nome_projeto: cfg?.nome_projeto ?? "",
    nome_completo: cfg?.nome_completo ?? null,
    logo_url: cfg?.logo_url ?? null,
    telefone: cfg?.telefone ?? null,
    email: cfg?.email ?? null,
    cidade: cfg?.cidade ?? null,
    estado: cfg?.estado ?? null,
    endereco_completo: cfg?.endereco_completo ?? null,
    veiculos: (veiculos ?? [])
      .filter((v) => (v.status ?? "ativo") !== "inativo")
      .map((v) => ({
        id: v.id,
        marca: v.marca,
        modelo: v.modelo,
        ano: v.ano ?? null,
        tipo_veiculo: v.tipo_veiculo ?? null,
        cor: v.cor ?? null,
        imagem_capa_url: v.imagem_capa_url,
      })),
  };
}

// ─── Helpers de imagem ──────────────────────────────────────

type ImgMeta = { data: string; w: number; h: number } | null;

async function urlToDataUrl(url: string | null | undefined): Promise<ImgMeta> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { data: dataUrl, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

function drawImageCover(
  doc: jsPDF,
  meta: ImgMeta,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (!meta) return;
  try {
    doc.addImage(meta.data, "JPEG", x, y, w, h, undefined, "FAST", 0);
  } catch {
    try {
      doc.addImage(meta.data, "PNG", x, y, w, h);
    } catch {
      // ignore
    }
  }
}

function drawImageContain(
  doc: jsPDF,
  meta: ImgMeta,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (!meta) return;
  const ratioBox = w / h;
  const ratioImg = meta.w / meta.h;
  let dw = w;
  let dh = h;
  if (ratioImg > ratioBox) {
    dh = w / ratioImg;
  } else {
    dw = h * ratioImg;
  }
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  try {
    doc.addImage(meta.data, "PNG", dx, dy, dw, dh);
  } catch {
    try {
      doc.addImage(meta.data, "JPEG", dx, dy, dw, dh);
    } catch {
      // ignore
    }
  }
}

// ─── Helpers de desenho ─────────────────────────────────────

function fillRect(doc: jsPDF, x: number, y: number, w: number, h: number, hex: string, radius = 0) {
  doc.setFillColor(hex);
  if (radius > 0) doc.roundedRect(x, y, w, h, radius, radius, "F");
  else doc.rect(x, y, w, h, "F");
}

function strokeRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  hex: string,
  radius = 0,
  lineWidth = 0.3,
) {
  doc.setDrawColor(hex);
  doc.setLineWidth(lineWidth);
  if (radius > 0) doc.roundedRect(x, y, w, h, radius, radius, "S");
  else doc.rect(x, y, w, h, "S");
}

function text(
  doc: jsPDF,
  content: string,
  x: number,
  y: number,
  opts: {
    size?: number;
    color?: string;
    weight?: "normal" | "bold";
    align?: "left" | "center" | "right";
    maxW?: number;
    lineHeight?: number;
    letterSpacing?: number;
  } = {},
) {
  const size = opts.size ?? 10;
  const weight = opts.weight ?? "normal";
  doc.setFont("helvetica", weight);
  doc.setFontSize(size);
  doc.setTextColor(opts.color ?? "#FFFFFF");
  if (opts.letterSpacing) {
    doc.setCharSpace(opts.letterSpacing);
  } else {
    doc.setCharSpace(0);
  }
  if (opts.maxW) {
    const lines = doc.splitTextToSize(content, opts.maxW) as string[];
    const lh = opts.lineHeight ?? size * 0.4;
    let cursorY = y;
    for (const line of lines) {
      doc.text(line, x, cursorY, { align: opts.align ?? "left" });
      cursorY += lh;
    }
    doc.setCharSpace(0);
    return cursorY;
  }
  doc.text(content, x, y, { align: opts.align ?? "left" });
  doc.setCharSpace(0);
  return y;
}

function drawPageBg(doc: jsPDF, p: Palette) {
  fillRect(doc, 0, 0, PAGE_W, PAGE_H, p.bg);
}

function drawPageFrame(doc: jsPDF, p: Palette, accent: string, label: string, pageNum: number) {
  // cabeçalho fino
  fillRect(doc, 0, 0, PAGE_W, 6, p.surface);
  fillRect(doc, 0, 0, 40, 6, accent);
  // rodapé
  fillRect(doc, 0, PAGE_H - 9, PAGE_W, 9, p.bgSoft);
  fillRect(doc, 0, PAGE_H - 9, 40, 9, accent);
  text(doc, label.toUpperCase(), MARGIN, PAGE_H - 3.5, {
    size: 7,
    color: p.textMuted,
    weight: "bold",
    letterSpacing: 1.2,
  });
  text(doc, String(pageNum).padStart(2, "0"), PAGE_W - MARGIN, PAGE_H - 3.5, {
    size: 8,
    color: p.textSecondary,
    weight: "bold",
    align: "right",
  });
}

function drawAccentBar(doc: jsPDF, x: number, y: number, w: number, accent: string) {
  fillRect(doc, x, y, w, 1.6, accent);
}

// ─── Páginas ────────────────────────────────────────────────

async function pageCapa(
  doc: jsPDF,
  cfg: CatalogoConfig,
  sys: CatalogoDadosSistema,
  p: Palette,
  logo: ImgMeta,
  capa: ImgMeta,
) {
  drawPageBg(doc, p);

  // Bloco hero (banner de capa opcional)
  const heroH = PAGE_H - 54;
  if (capa) {
    drawImageCover(doc, capa, 0, 0, PAGE_W, heroH);
    // Overlay dark com gradient fake (3 faixas)
    for (let i = 0; i < 18; i += 1) {
      const alpha = Math.min(1, 0.02 + i * 0.05);
      doc.setGState(doc.GState({ opacity: alpha }));
      fillRect(doc, 0, heroH - i * 2.5 - 30, PAGE_W, 3, p.bg);
    }
    doc.setGState(doc.GState({ opacity: 1 }));
    // Overlay vertical para dar profundidade
    doc.setGState(doc.GState({ opacity: 0.55 }));
    fillRect(doc, 0, 0, PAGE_W * 0.55, heroH, p.bg);
    doc.setGState(doc.GState({ opacity: 1 }));
  } else {
    fillRect(doc, 0, 0, PAGE_W, heroH, p.bgSoft);
    // stripes decorativas
    doc.setGState(doc.GState({ opacity: 0.4 }));
    fillRect(doc, PAGE_W - 90, 0, 90, heroH, p.surface);
    doc.setGState(doc.GState({ opacity: 1 }));
    // Linhas decorativas
    for (let i = 0; i < 5; i += 1) {
      const y = 20 + i * 30;
      doc.setDrawColor(p.line);
      doc.setLineWidth(0.1);
      doc.line(PAGE_W - 85, y, PAGE_W - 10, y);
    }
  }

  // Accent vertical
  fillRect(doc, MARGIN, 16, 2.5, heroH - 32, cfg.cor_acento);

  // Logo pequeno + nome do projeto
  const headerX = MARGIN + 10;
  if (logo) {
    drawImageContain(doc, logo, headerX, 16, 18, 18);
    text(doc, sys.nome_projeto, headerX + 22, 28, {
      size: 11,
      color: p.textSecondary,
      weight: "bold",
      letterSpacing: 1.5,
    });
  } else {
    text(doc, sys.nome_projeto, headerX, 28, {
      size: 14,
      color: p.textPrimary,
      weight: "bold",
      letterSpacing: 2,
    });
  }

  // Slogan — bloco principal
  const slogan = cfg.slogan.trim() || "TRANSPORTE PREMIUM";
  const sloganLines = slogan.split("\n").filter(Boolean);
  const startY = 78;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(46);
  doc.setTextColor(p.textPrimary);
  doc.setCharSpace(1.6);
  let sy = startY;
  for (const line of sloganLines.length ? sloganLines : [slogan]) {
    doc.text(line.toUpperCase(), MARGIN + 10, sy);
    sy += 18;
  }
  doc.setCharSpace(0);

  // Accent line
  drawAccentBar(doc, MARGIN + 10, sy - 2, 40, cfg.cor_acento);

  // Subtitulo
  text(doc, cfg.subtitulo, MARGIN + 10, sy + 10, {
    size: 10.5,
    color: p.textSecondary,
    maxW: 150,
    lineHeight: 5,
  });

  // Rodapé tipo banner
  fillRect(doc, 0, PAGE_H - 54, PAGE_W, 54, p.bg);
  fillRect(doc, 0, PAGE_H - 54, PAGE_W, 0.4, p.line);

  const contactY = PAGE_H - 34;
  const contactItems: Array<{ label: string; value: string }> = [];
  if (cfg.site_url) contactItems.push({ label: "Web", value: cfg.site_url });
  if (cfg.whatsapp_e164) contactItems.push({ label: "WhatsApp", value: cfg.whatsapp_e164 });
  else if (sys.telefone) contactItems.push({ label: "Contacto", value: sys.telefone });
  if (cfg.instagram_handle) contactItems.push({ label: "Instagram", value: cfg.instagram_handle });
  if (sys.email) contactItems.push({ label: "Email", value: sys.email });

  const colW = CONTENT_W / Math.max(1, contactItems.length);
  contactItems.forEach((item, i) => {
    const cx = MARGIN + colW * i;
    text(doc, item.label.toUpperCase(), cx, contactY, {
      size: 7,
      color: cfg.cor_acento,
      weight: "bold",
      letterSpacing: 1.5,
    });
    text(doc, item.value, cx, contactY + 6, {
      size: 10,
      color: p.textPrimary,
      weight: "bold",
    });
  });

  // Badge "Catálogo"
  fillRect(doc, PAGE_W - MARGIN - 36, PAGE_H - 54 - 12, 36, 7, cfg.cor_acento);
  text(doc, "CATÁLOGO COMERCIAL", PAGE_W - MARGIN - 18, PAGE_H - 54 - 7, {
    size: 7,
    color: "#FFFFFF",
    weight: "bold",
    align: "center",
    letterSpacing: 1.3,
  });

  drawPageFrame(doc, p, cfg.cor_acento, sys.nome_projeto, 1);
}

function pageSobre(
  doc: jsPDF,
  cfg: CatalogoConfig,
  sys: CatalogoDadosSistema,
  p: Palette,
  pageNum: number,
) {
  doc.addPage();
  drawPageBg(doc, p);

  // coluna da esquerda: título grande
  const leftW = CONTENT_W * 0.42;
  const leftX = MARGIN;
  const topY = 30;

  text(doc, "SOBRE", leftX, topY, {
    size: 42,
    color: p.textPrimary,
    weight: "bold",
    letterSpacing: 2,
  });
  text(doc, "NÓS", leftX, topY + 18, {
    size: 42,
    color: cfg.cor_acento,
    weight: "bold",
    letterSpacing: 2,
  });
  drawAccentBar(doc, leftX, topY + 26, 50, cfg.cor_acento);

  text(
    doc,
    "Conheça a filosofia, compromissos e valores que elevam cada viagem a uma experiência premium.",
    leftX,
    topY + 40,
    {
      size: 9.5,
      color: p.textMuted,
      maxW: leftW - 10,
      lineHeight: 5,
    },
  );

  // bloco de números
  const statsY = topY + 78;
  const stats: Array<{ valor: string; label: string }> = [
    {
      valor: String(sys.veiculos.length || "—"),
      label: "Veículos na frota",
    },
    {
      valor: cfg.cidades_atendidas.length ? String(cfg.cidades_atendidas.length) : "—",
      label: "Cidades atendidas",
    },
    {
      valor: cfg.servicos_destaque.length ? String(cfg.servicos_destaque.length) : "—",
      label: "Serviços",
    },
  ];
  const sw = (leftW - 10) / 3;
  stats.forEach((s, i) => {
    const sx = leftX + i * sw;
    fillRect(doc, sx, statsY, sw - 4, 30, p.surface, 2);
    text(doc, s.valor, sx + (sw - 4) / 2, statsY + 15, {
      size: 20,
      color: cfg.cor_acento,
      weight: "bold",
      align: "center",
    });
    text(doc, s.label.toUpperCase(), sx + (sw - 4) / 2, statsY + 24, {
      size: 7,
      color: p.textMuted,
      weight: "bold",
      align: "center",
      letterSpacing: 0.8,
    });
  });

  // coluna direita: texto
  const rightX = MARGIN + leftW + 6;
  const rightW = CONTENT_W - leftW - 6;
  fillRect(doc, rightX, topY, rightW, PAGE_H - topY - 25, p.bgSoft, 3);
  const padX = rightX + 10;
  const padY = topY + 12;
  text(doc, "O NOSSO COMPROMISSO", padX, padY, {
    size: 8,
    color: cfg.cor_acento,
    weight: "bold",
    letterSpacing: 1.5,
  });
  text(doc, sys.nome_projeto || "Frota Executiva", padX, padY + 10, {
    size: 18,
    color: p.textPrimary,
    weight: "bold",
  });
  drawAccentBar(doc, padX, padY + 14, 16, cfg.cor_acento);

  text(doc, cfg.sobre_nos || "Complete o campo 'Sobre nós' para personalizar.", padX, padY + 26, {
    size: 10,
    color: p.textSecondary,
    maxW: rightW - 20,
    lineHeight: 5.2,
  });

  drawPageFrame(doc, p, cfg.cor_acento, "Sobre nós", pageNum);
}

function pageServicos(
  doc: jsPDF,
  cfg: CatalogoConfig,
  p: Palette,
  pageNum: number,
) {
  const servicos = cfg.servicos_destaque.filter((s) => s.titulo?.trim());
  if (!servicos.length) return false;

  doc.addPage();
  drawPageBg(doc, p);

  // Título superior
  const titleY = 28;
  text(doc, "SERVIÇOS EXCLUSIVOS", MARGIN, titleY, {
    size: 8,
    color: cfg.cor_acento,
    weight: "bold",
    letterSpacing: 2,
  });
  text(doc, "O QUE OFERECEMOS", MARGIN, titleY + 10, {
    size: 28,
    color: p.textPrimary,
    weight: "bold",
    letterSpacing: 1,
  });
  drawAccentBar(doc, MARGIN, titleY + 14, 24, cfg.cor_acento);

  // Grid dinâmico
  const cols = servicos.length <= 4 ? 2 : 3;
  const rows = Math.ceil(servicos.length / cols);
  const gap = 5;
  const gridTop = titleY + 26;
  const gridH = PAGE_H - gridTop - 22;
  const cellW = (CONTENT_W - gap * (cols - 1)) / cols;
  const cellH = (gridH - gap * (rows - 1)) / rows;

  servicos.forEach((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cellW + gap);
    const y = gridTop + row * (cellH + gap);
    fillRect(doc, x, y, cellW, cellH, p.surface, 3);

    // número + accent
    const numero = String(i + 1).padStart(2, "0");
    fillRect(doc, x, y, 3, cellH, cfg.cor_acento);
    text(doc, numero, x + 8, y + 12, {
      size: 22,
      color: cfg.cor_acento,
      weight: "bold",
    });
    text(doc, s.titulo.toUpperCase(), x + 8, y + 22, {
      size: 11,
      color: p.textPrimary,
      weight: "bold",
      letterSpacing: 1,
      maxW: cellW - 14,
      lineHeight: 5,
    });
    text(doc, s.descricao || "", x + 8, y + 32, {
      size: 9,
      color: p.textSecondary,
      maxW: cellW - 14,
      lineHeight: 4.4,
    });
  });

  drawPageFrame(doc, p, cfg.cor_acento, "Serviços", pageNum);
  return true;
}

async function pageFrota(
  doc: jsPDF,
  cfg: CatalogoConfig,
  sys: CatalogoDadosSistema,
  p: Palette,
  veiculosImgs: Array<ImgMeta>,
  pageNum: number,
) {
  if (!sys.veiculos.length) return { drawn: false, pageNum };

  doc.addPage();
  drawPageBg(doc, p);

  const titleY = 28;
  text(doc, "FROTA PREMIUM", MARGIN, titleY, {
    size: 8,
    color: cfg.cor_acento,
    weight: "bold",
    letterSpacing: 2,
  });
  text(doc, "NOSSOS VEÍCULOS", MARGIN, titleY + 10, {
    size: 28,
    color: p.textPrimary,
    weight: "bold",
    letterSpacing: 1,
  });
  drawAccentBar(doc, MARGIN, titleY + 14, 24, cfg.cor_acento);

  // exibir até 6 por página em grid 3x2
  const perPage = 6;
  const cols = 3;
  const gap = 5;
  const gridTop = titleY + 26;
  const gridH = PAGE_H - gridTop - 22;
  const cellW = (CONTENT_W - gap * (cols - 1)) / cols;
  const cellH = (gridH - gap) / 2;
  const imgH = cellH * 0.62;

  let currentPage = 0;
  for (let i = 0; i < sys.veiculos.length; i += 1) {
    const indexOnPage = i % perPage;
    if (indexOnPage === 0 && i > 0) {
      doc.addPage();
      drawPageBg(doc, p);
      text(doc, "FROTA PREMIUM", MARGIN, titleY, {
        size: 8,
        color: cfg.cor_acento,
        weight: "bold",
        letterSpacing: 2,
      });
      text(doc, "NOSSOS VEÍCULOS", MARGIN, titleY + 10, {
        size: 28,
        color: p.textPrimary,
        weight: "bold",
        letterSpacing: 1,
      });
      drawAccentBar(doc, MARGIN, titleY + 14, 24, cfg.cor_acento);
      currentPage += 1;
      drawPageFrame(doc, p, cfg.cor_acento, "Frota", pageNum + currentPage);
    }
    const col = indexOnPage % cols;
    const row = Math.floor(indexOnPage / cols);
    const x = MARGIN + col * (cellW + gap);
    const y = gridTop + row * (cellH + gap);

    // card
    fillRect(doc, x, y, cellW, cellH, p.surface, 3);
    // image area
    fillRect(doc, x, y, cellW, imgH, p.bg, 3);
    const imgMeta = veiculosImgs[i];
    if (imgMeta) {
      drawImageCover(doc, imgMeta, x + 2, y + 2, cellW - 4, imgH - 4);
    } else {
      // placeholder
      text(doc, "SEM IMAGEM", x + cellW / 2, y + imgH / 2 + 2, {
        size: 8,
        color: p.textMuted,
        align: "center",
        letterSpacing: 1.5,
      });
    }
    // info
    const v = sys.veiculos[i];
    const tipoLabel = (v.tipo_veiculo ?? "").toUpperCase() || "EXECUTIVO";
    fillRect(doc, x + 6, y + imgH + 4, 20, 4, cfg.cor_acento, 1);
    text(doc, tipoLabel, x + 16, y + imgH + 7.2, {
      size: 6,
      color: "#FFFFFF",
      weight: "bold",
      align: "center",
      letterSpacing: 1,
    });
    text(doc, `${v.marca} ${v.modelo}`.trim(), x + 6, y + imgH + 15, {
      size: 11,
      color: p.textPrimary,
      weight: "bold",
      maxW: cellW - 12,
    });
    const meta = [v.ano, v.cor].filter(Boolean).join(" • ");
    if (meta) {
      text(doc, meta, x + 6, y + imgH + 21, {
        size: 8,
        color: p.textMuted,
      });
    }
  }
  if (currentPage === 0) {
    drawPageFrame(doc, p, cfg.cor_acento, "Frota", pageNum);
  }
  return { drawn: true, pageNum: pageNum + currentPage };
}

function pageComodidades(
  doc: jsPDF,
  cfg: CatalogoConfig,
  p: Palette,
  pageNum: number,
) {
  const comodidades = cfg.comodidades.filter((c) => c.titulo?.trim());
  if (!comodidades.length) return false;

  doc.addPage();
  drawPageBg(doc, p);

  const titleY = 28;
  text(doc, "EXPERIÊNCIA A BORDO", MARGIN, titleY, {
    size: 8,
    color: cfg.cor_acento,
    weight: "bold",
    letterSpacing: 2,
  });
  text(doc, "COMODIDADES", MARGIN, titleY + 10, {
    size: 28,
    color: p.textPrimary,
    weight: "bold",
    letterSpacing: 1,
  });
  drawAccentBar(doc, MARGIN, titleY + 14, 24, cfg.cor_acento);

  // Grid responsivo
  const cols = comodidades.length <= 4 ? 2 : comodidades.length <= 6 ? 3 : 4;
  const rows = Math.ceil(comodidades.length / cols);
  const gap = 5;
  const gridTop = titleY + 28;
  const gridH = PAGE_H - gridTop - 22;
  const cellW = (CONTENT_W - gap * (cols - 1)) / cols;
  const cellH = (gridH - gap * (rows - 1)) / rows;

  comodidades.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cellW + gap);
    const y = gridTop + row * (cellH + gap);
    fillRect(doc, x, y, cellW, cellH, p.surface, 3);

    // número circle
    const cx = x + 10;
    const cy = y + 14;
    fillRect(doc, cx - 4, cy - 4, 10, 10, cfg.cor_acento, 2);
    text(doc, String(i + 1).padStart(2, "0"), cx + 1, cy + 3, {
      size: 7,
      color: "#FFFFFF",
      weight: "bold",
      align: "center",
    });

    text(doc, c.titulo.toUpperCase(), x + 10, y + cellH / 2 - 1, {
      size: 10.5,
      color: p.textPrimary,
      weight: "bold",
      maxW: cellW - 18,
      lineHeight: 5,
      letterSpacing: 1,
    });
    if (c.descricao) {
      text(doc, c.descricao, x + 10, y + cellH / 2 + 7, {
        size: 8,
        color: p.textMuted,
        maxW: cellW - 18,
        lineHeight: 4,
      });
    }
  });

  drawPageFrame(doc, p, cfg.cor_acento, "Comodidades", pageNum);
  return true;
}

function pageCidades(
  doc: jsPDF,
  cfg: CatalogoConfig,
  sys: CatalogoDadosSistema,
  p: Palette,
  pageNum: number,
) {
  const cidades = cfg.cidades_atendidas.filter(Boolean);
  if (!cidades.length) return false;

  doc.addPage();
  drawPageBg(doc, p);

  const titleY = 28;
  text(doc, "ONDE ATUAMOS", MARGIN, titleY, {
    size: 8,
    color: cfg.cor_acento,
    weight: "bold",
    letterSpacing: 2,
  });
  text(doc, "ÁREA DE ATENDIMENTO", MARGIN, titleY + 10, {
    size: 28,
    color: p.textPrimary,
    weight: "bold",
    letterSpacing: 1,
  });
  drawAccentBar(doc, MARGIN, titleY + 14, 24, cfg.cor_acento);

  const intro = sys.cidade
    ? `Sede em ${sys.cidade}${sys.estado ? ` — ${sys.estado}` : ""}. Oferecemos transporte executivo nas principais cidades e corredores.`
    : "Oferecemos transporte executivo nas principais cidades e corredores do país.";
  text(doc, intro, MARGIN, titleY + 22, {
    size: 10,
    color: p.textSecondary,
    maxW: CONTENT_W,
    lineHeight: 5,
  });

  // Grid de cidades (chips)
  const chipTop = titleY + 40;
  const chipH = 14;
  const gap = 4;
  const perRow = 4;
  const chipW = (CONTENT_W - gap * (perRow - 1)) / perRow;

  cidades.forEach((c, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const x = MARGIN + col * (chipW + gap);
    const y = chipTop + row * (chipH + gap);
    fillRect(doc, x, y, chipW, chipH, p.surface, 2);
    fillRect(doc, x, y, 2, chipH, cfg.cor_acento);
    text(doc, c, x + 6, y + chipH / 2 + 1.8, {
      size: 9.5,
      color: p.textPrimary,
      weight: "bold",
      maxW: chipW - 10,
    });
  });

  drawPageFrame(doc, p, cfg.cor_acento, "Abrangência", pageNum);
  return true;
}

function pageContracapa(
  doc: jsPDF,
  cfg: CatalogoConfig,
  sys: CatalogoDadosSistema,
  p: Palette,
  logo: ImgMeta,
  contracapa: ImgMeta,
  pageNum: number,
) {
  doc.addPage();
  drawPageBg(doc, p);

  // Background de destaque
  if (contracapa) {
    drawImageCover(doc, contracapa, 0, 0, PAGE_W, PAGE_H);
    doc.setGState(doc.GState({ opacity: 0.65 }));
    fillRect(doc, 0, 0, PAGE_W, PAGE_H, p.bg);
    doc.setGState(doc.GState({ opacity: 1 }));
  } else {
    // decoração gradient fake
    fillRect(doc, 0, 0, PAGE_W, PAGE_H, p.bg);
    fillRect(doc, PAGE_W - 150, -20, 200, 250, p.bgSoft);
    doc.setGState(doc.GState({ opacity: 0.08 }));
    fillRect(doc, PAGE_W - 120, -20, 180, 250, cfg.cor_acento);
    doc.setGState(doc.GState({ opacity: 1 }));
  }

  // Logo centrado
  const centerX = PAGE_W / 2;
  if (logo) {
    drawImageContain(doc, logo, centerX - 18, 30, 36, 36);
  }

  text(doc, sys.nome_projeto, centerX, 80, {
    size: 22,
    color: p.textPrimary,
    weight: "bold",
    align: "center",
    letterSpacing: 2,
  });
  drawAccentBar(doc, centerX - 20, 84, 40, cfg.cor_acento);
  text(doc, "CONTE CONNOSCO", centerX, 96, {
    size: 9,
    color: cfg.cor_acento,
    weight: "bold",
    align: "center",
    letterSpacing: 3,
  });

  // Cards de contacto
  const contactY = 112;
  const items: Array<{ label: string; value: string }> = [];
  if (cfg.whatsapp_e164) items.push({ label: "WhatsApp", value: cfg.whatsapp_e164 });
  else if (sys.telefone) items.push({ label: "Telefone", value: sys.telefone });
  if (sys.email) items.push({ label: "Email", value: sys.email });
  if (cfg.site_url) items.push({ label: "Website", value: cfg.site_url });
  if (cfg.instagram_handle) items.push({ label: "Instagram", value: cfg.instagram_handle });

  const colCount = Math.max(1, Math.min(items.length, 4));
  const colW = CONTENT_W / colCount;
  items.slice(0, colCount).forEach((it, idx) => {
    const x = MARGIN + idx * colW;
    fillRect(doc, x + 4, contactY, colW - 8, 28, p.surface, 3);
    text(doc, it.label.toUpperCase(), x + 10, contactY + 9, {
      size: 7,
      color: cfg.cor_acento,
      weight: "bold",
      letterSpacing: 1.5,
    });
    text(doc, it.value, x + 10, contactY + 20, {
      size: 10.5,
      color: p.textPrimary,
      weight: "bold",
      maxW: colW - 20,
    });
  });

  // Endereço (se houver)
  if (sys.endereco_completo) {
    const addrY = 160;
    text(doc, "ENDEREÇO", centerX, addrY, {
      size: 7,
      color: cfg.cor_acento,
      weight: "bold",
      align: "center",
      letterSpacing: 2,
    });
    text(doc, sys.endereco_completo, centerX, addrY + 6, {
      size: 9,
      color: p.textSecondary,
      align: "center",
      maxW: 180,
      lineHeight: 4.5,
    });
  }

  drawPageFrame(doc, p, cfg.cor_acento, "Contacto", pageNum);
}

// ─── Entry point ────────────────────────────────────────────

export async function gerarCatalogoPdf(
  cfg: CatalogoConfig,
  sys: CatalogoDadosSistema,
): Promise<{ blob: Blob; filename: string }> {
  const palette = PALETTES[cfg.tema] ?? PALETTES.dark;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Pré-carrega imagens
  const [logo, capa, contracapa, ...veiculosImgs] = await Promise.all([
    urlToDataUrl(sys.logo_url),
    urlToDataUrl(cfg.banner_capa_url),
    urlToDataUrl(cfg.banner_contracapa_url),
    ...sys.veiculos.map((v) => urlToDataUrl(v.imagem_capa_url)),
  ]);

  let pageNum = 1;

  await pageCapa(doc, cfg, sys, palette, logo, capa);

  pageNum += 1;
  pageSobre(doc, cfg, sys, palette, pageNum);

  if (pageServicos(doc, cfg, palette, pageNum + 1)) pageNum += 1;

  const frota = await pageFrota(doc, cfg, sys, palette, veiculosImgs, pageNum + 1);
  if (frota.drawn) pageNum = frota.pageNum;

  if (pageComodidades(doc, cfg, palette, pageNum + 1)) pageNum += 1;

  if (pageCidades(doc, cfg, sys, palette, pageNum + 1)) pageNum += 1;

  pageNum += 1;
  pageContracapa(doc, cfg, sys, palette, logo, contracapa, pageNum);

  const blob = doc.output("blob");
  const safeName = (sys.nome_projeto || "catalogo")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "catalogo";
  const filename = `catalogo-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;
  return { blob, filename };
}
