/** Normalização das respostas documentadas da UAZAPI. Não inventa texto nem status. */

export const STATUS_UAZAPI = ["Queued", "Canceled", "Failed", "Sent", "Delivered", "Read", "Played"] as const;
export type StatusUazapi = (typeof STATUS_UAZAPI)[number];

const RANK: Record<StatusUazapi, number> = {
  Queued: 1,
  Sent: 2,
  Delivered: 3,
  Read: 4,
  Played: 5,
  Failed: 0,
  Canceled: 0,
};

export type ChatConversa = {
  chatid: string;
  chatlid: string | null;
  titulo: string;
  previa: string | null;
  foto: string | null;
  timestampMs: number | null;
  naoLidas: number | null;
  grupo: boolean | null;
};

export type ChatMensagem = {
  chave: string;
  id: string | null;
  messageid: string | null;
  chatid: string;
  fromMe: boolean | null;
  texto: string | null;
  tipo: string | null;
  status: StatusUazapi | null;
  remetente: string | null;
  remetenteNome: string | null;
  enviadaPelaApi: boolean | null;
  erro: string | null;
  arquivo: string | null;
  timestampMs: number | null;
};

export type HistoricoPedido = {
  status: string | null;
  hasMore: boolean | null;
  historyAccess: string | null;
  timedOut: boolean;
  received: number | null;
  error: string | null;
  nextRequest: Record<string, unknown> | null;
};

function https(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.startsWith("https://") ? t : null;
}

function texto(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function bool(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  return null;
}

function numero(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function timestampMs(v: unknown): number | null {
  const n = numero(v);
  if (n == null || n <= 0) return null;
  if (n < 1e12) return Math.floor(n * 1000);
  return Math.floor(n);
}

export function statusUazapi(v: unknown): StatusUazapi | null {
  if (typeof v !== "string") return null;
  return (STATUS_UAZAPI as readonly string[]).includes(v) ? (v as StatusUazapi) : null;
}

/** Entrega e leitura só avançam. Falha não apaga um envio já confirmado. */
function falha(s: StatusUazapi): boolean {
  return s === "Failed" || s === "Canceled";
}

export function escolherStatus(atual: StatusUazapi | null, novo: StatusUazapi | null): StatusUazapi | null {
  if (!novo) return atual;
  if (!atual) return novo;
  if (falha(novo) && !falha(atual) && RANK[atual] >= RANK.Sent) return atual;
  if (falha(atual) && !falha(novo) && RANK[novo] >= RANK.Sent) return novo;
  if (falha(novo) && (falha(atual) || atual === "Queued")) return novo;
  if (falha(atual) && novo === "Queued") return atual;
  return RANK[novo] > RANK[atual] ? novo : atual;
}

export function chaveMensagem(id: unknown, messageid: unknown): string | null {
  const mid = texto(messageid);
  const interno = texto(id);
  return mid || interno;
}

export function normalizarConversa(raw: unknown): ChatConversa | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const chatid = texto(o.wa_chatid) || texto(o.chatid);
  if (!chatid) return null;
  const titulo =
    texto(o.wa_contactName) ||
    texto(o.name) ||
    texto(o.wa_name) ||
    texto(o.lead_name) ||
    texto(o.phone) ||
    chatid;
  const naoLidas = numero(o.wa_unreadCount);
  return {
    chatid,
    chatlid: texto(o.wa_chatlid),
    titulo,
    previa: texto(o.wa_lastMessageTextVote),
    foto: https(o.imagePreview) || https(o.image),
    timestampMs: timestampMs(o.wa_lastMsgTimestamp),
    naoLidas: naoLidas != null && naoLidas >= 0 ? Math.floor(naoLidas) : null,
    grupo: bool(o.wa_isGroup),
  };
}

export function normalizarMensagem(raw: unknown, chatidFallback?: string | null): ChatMensagem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const chave = chaveMensagem(o.id, o.messageid);
  const chatid = texto(o.chatid) || texto(chatidFallback);
  if (!chave || !chatid) return null;
  const messageType = texto(o.messageType);
  const mediaType = texto(o.mediaType);
  const type = texto(o.type);
  const tipo =
    mediaType ||
    (type && type !== "media" && type !== "text" ? type : null) ||
    messageType;
  return {
    chave,
    id: texto(o.id),
    messageid: texto(o.messageid),
    chatid,
    fromMe: bool(o.fromMe),
    texto: texto(o.text),
    tipo,
    status: statusUazapi(o.status),
    remetente: texto(o.sender),
    remetenteNome: texto(o.senderName),
    enviadaPelaApi: bool(o.wasSentByApi),
    erro: texto(o.error),
    arquivo: https(o.fileURL),
    timestampMs: timestampMs(o.messageTimestamp),
  };
}

export function fundirMensagens(atual: ChatMensagem[], novas: ChatMensagem[]): ChatMensagem[] {
  const mapa = new Map<string, ChatMensagem>();
  for (const m of atual) mapa.set(m.chave, m);
  for (const n of novas) {
    const anterior = mapa.get(n.chave);
    if (!anterior) {
      mapa.set(n.chave, n);
      continue;
    }
    mapa.set(n.chave, {
      ...anterior,
      ...n,
      texto: n.texto || anterior.texto,
      tipo: n.tipo || anterior.tipo,
      remetente: n.remetente || anterior.remetente,
      remetenteNome: n.remetenteNome || anterior.remetenteNome,
      fromMe: n.fromMe ?? anterior.fromMe,
      enviadaPelaApi: n.enviadaPelaApi ?? anterior.enviadaPelaApi,
      erro: n.erro || anterior.erro,
      arquivo: n.arquivo || anterior.arquivo,
      timestampMs: n.timestampMs ?? anterior.timestampMs,
      status: escolherStatus(anterior.status, n.status),
      id: n.id || anterior.id,
      messageid: n.messageid || anterior.messageid,
    });
  }
  return [...mapa.values()].sort((a, b) => {
    const ta = a.timestampMs ?? Number.MAX_SAFE_INTEGER;
    const tb = b.timestampMs ?? Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    return a.chave.localeCompare(b.chave);
  });
}

const NEXT_KEYS = ["number", "messageid", "count", "timestamp", "fromMe", "fallbackMode"] as const;

export function pedidoHistoricoSeguro(raw: unknown, chatid: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const number = texto(o.number);
  if (!number || number !== chatid) return null;
  const out: Record<string, unknown> = { number };
  for (const k of NEXT_KEYS) {
    if (k === "number") continue;
    const v = o[k];
    if (k === "fromMe" && (v === true || v === false)) out[k] = v;
    else if ((k === "count" || k === "timestamp") && typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if ((k === "messageid" || k === "fallbackMode") && typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  if (out.fallbackMode !== "try_alternates" && out.fallbackMode !== "exact") delete out.fallbackMode;
  if (typeof out.count === "number") out.count = Math.min(100, Math.max(1, Math.floor(out.count)));
  return out;
}

export function lerHistorico(json: unknown, chatid: string): HistoricoPedido {
  const o = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const has = o.has_more;
  const access = texto(o.history_access);
  return {
    status: texto(o.status),
    hasMore: has === true || has === false ? has : null,
    historyAccess: access === "available" || access === "unavailable" || access === "unknown" ? access : null,
    timedOut: o.timed_out === true,
    received: numero(o.received_messages) != null ? Math.floor(numero(o.received_messages) as number) : null,
    error: texto(o.error),
    nextRequest: pedidoHistoricoSeguro(o.next_request, chatid),
  };
}

export function mensagensDoHistorico(json: unknown): unknown[] {
  if (!json || typeof json !== "object") return [];
  const lista = (json as { messages?: unknown }).messages;
  return Array.isArray(lista) ? lista : [];
}

export function paginacao(json: unknown): { hasMore: boolean; nextOffset: number | null } {
  const o = json && typeof json === "object" ? (json as { pagination?: unknown }).pagination : null;
  if (!o || typeof o !== "object") return { hasMore: false, nextOffset: null };
  const p = o as { hasMore?: unknown; nextOffset?: unknown; totalRecords?: unknown; limit?: unknown; offset?: unknown };
  if (p.hasMore === true || p.hasMore === false) {
    const next = numero(p.nextOffset);
    return { hasMore: p.hasMore === true, nextOffset: next != null ? Math.max(0, Math.floor(next)) : null };
  }
  const total = numero(p.totalRecords);
  const limit = numero(p.limit);
  const offset = numero(p.offset);
  if (total != null && limit != null && offset != null) {
    const hasMore = offset + limit < total;
    return { hasMore, nextOffset: hasMore ? Math.floor(offset + limit) : null };
  }
  return { hasMore: false, nextOffset: null };
}

export function listaDe(json: unknown, chave: "chats" | "messages"): unknown[] {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  const lista = o[chave] ?? o.data ?? o.records;
  return Array.isArray(lista) ? lista : [];
}
