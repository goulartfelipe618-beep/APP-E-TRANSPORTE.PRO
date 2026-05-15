/** Parsing defensivo das respostas Evolution (Baileys). */

export type UiMsg = {
  id: string;
  remoteJid: string;
  fromMe: boolean;
  tsMs: number;
  kind: "text" | "media" | "audio" | "unknown";
  text?: string;
  mediaUrl?: string;
  mimetype?: string;
  fileName?: string;
  isPtt?: boolean;
  seconds?: number;
};

export function toTsMs(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v < 1e12) return Math.floor(v * 1000);
    return Math.floor(v);
  }
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) {
      if (n < 1e12) return Math.floor(n * 1000);
      return Math.floor(n);
    }
  }
  return null;
}

function readKey(obj: Record<string, unknown>): { remoteJid: string; fromMe: boolean; id: string } | null {
  const k = obj.key;
  if (!k || typeof k !== "object") return null;
  const o = k as Record<string, unknown>;
  const remoteJid = typeof o.remoteJid === "string" ? o.remoteJid : "";
  let id =
    typeof o.id === "string"
      ? o.id
      : typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}`;
  const fromMe = o.fromMe === true;
  if (!remoteJid) return null;
  return { remoteJid, fromMe, id };
}

function pickTextFromMessage(m: Record<string, unknown>): string | null {
  if (typeof m.conversation === "string" && m.conversation.trim()) return m.conversation;
  const ext = m.extendedTextMessage;
  if (ext && typeof ext === "object") {
    const t = (ext as { text?: unknown }).text;
    if (typeof t === "string" && t.trim()) return t;
  }
  const img = m.imageMessage;
  if (img && typeof img === "object") {
    const c = (img as { caption?: unknown }).caption;
    if (typeof c === "string" && c.trim()) return c;
  }
  const vid = m.videoMessage;
  if (vid && typeof vid === "object") {
    const c = (vid as { caption?: unknown }).caption;
    if (typeof c === "string" && c.trim()) return c;
  }
  const doc = m.documentMessage;
  if (doc && typeof doc === "object") {
    const c = (doc as { caption?: unknown }).caption;
    if (typeof c === "string" && c.trim()) return c;
    const fn = (doc as { fileName?: unknown }).fileName;
    if (typeof fn === "string" && fn.trim()) return `📎 ${fn}`;
  }
  const aud = m.audioMessage;
  if (aud && typeof aud === "object") {
    return "🎤 Áudio";
  }
  return null;
}

function pickMedia(obj: Record<string, unknown>): Omit<UiMsg, "id" | "remoteJid" | "fromMe" | "tsMs"> {
  const m = obj.message;
  if (!m || typeof m !== "object") {
    return { kind: "unknown" };
  }
  const msg = m as Record<string, unknown>;
  const txt = pickTextFromMessage(msg);
  const aud = msg.audioMessage;
  if (aud && typeof aud === "object") {
    const a = aud as Record<string, unknown>;
    const url = typeof a.url === "string" ? a.url : undefined;
    const secs = typeof a.seconds === "number" ? a.seconds : undefined;
    return {
      kind: "audio",
      text: txt ?? undefined,
      mediaUrl: url,
      mimetype: typeof a.mimetype === "string" ? a.mimetype : undefined,
      isPtt: a.ptt === true,
      seconds: secs,
    };
  }
  const img = msg.imageMessage;
  if (img && typeof img === "object") {
    const a = img as Record<string, unknown>;
    return {
      kind: "media",
      text: txt ?? undefined,
      mediaUrl: typeof a.url === "string" ? a.url : undefined,
      mimetype: typeof a.mimetype === "string" ? a.mimetype : undefined,
    };
  }
  const vid = msg.videoMessage;
  if (vid && typeof vid === "object") {
    const a = vid as Record<string, unknown>;
    return {
      kind: "media",
      text: txt ?? "Vídeo",
      mediaUrl: typeof a.url === "string" ? a.url : undefined,
      mimetype: typeof a.mimetype === "string" ? a.mimetype : undefined,
    };
  }
  const doc = msg.documentMessage;
  if (doc && typeof doc === "object") {
    const a = doc as Record<string, unknown>;
    return {
      kind: "media",
      text: txt ?? undefined,
      mediaUrl: typeof a.url === "string" ? a.url : undefined,
      mimetype: typeof a.mimetype === "string" ? a.mimetype : undefined,
      fileName: typeof a.fileName === "string" ? a.fileName : undefined,
    };
  }
  if (txt) {
    return { kind: "text", text: txt };
  }
  return { kind: "unknown" };
}

export function normalizeEvolutionChatRow(raw: unknown): {
  remoteJid: string;
  title: string;
  tsMs: number | null;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const remoteJid =
    (typeof o.remoteJid === "string" && o.remoteJid) ||
    (typeof o.id === "string" && o.id.includes("@") ? o.id : "") ||
    ((typeof (o as { key?: unknown }).key === "object" &&
      (o as { key?: { remoteJid?: string } }).key?.remoteJid)
      ? String((o as { key: { remoteJid?: string } }).key.remoteJid)
      : "");
  if (!remoteJid) return null;

  const title =
    (typeof o.name === "string" && o.name.trim()) ||
    (typeof o.pushName === "string" && o.pushName.trim()) ||
    (typeof o.subject === "string" && o.subject.trim()) ||
    remoteJid.split("@")[0] ||
    "?";

  const tsMs =
    toTsMs(o.updatedAt) ??
    toTsMs(o.updated_at) ??
    toTsMs(o.conversationTimestamp) ??
    (typeof (o.lastMessageTimestamp as unknown) !== "undefined" ? toTsMs(o.lastMessageTimestamp) : null);

  return { remoteJid, title, tsMs };
}

export function normalizeEvolutionMessageRow(raw: unknown): UiMsg | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const baseKey = readKey(o);
  if (!baseKey) return null;

  let tsMs = toTsMs(o.messageTimestamp) ?? toTsMs(o.timestamp);

  const mergedInput: Record<string, unknown> = { ...o };
  /** Caso estruturas aninhadas */
  let walk: Record<string, unknown> | null = mergedInput;
  for (let i = 0; i < 3 && walk?.message != null && typeof walk.message === "object"; i++) {
    tsMs =
      tsMs ??
      (typeof walk.messageTimestamp !== "undefined" ? toTsMs(walk.messageTimestamp) : null) ??
      tsMs;
    walk = walk.message as Record<string, unknown>;
    if ("messageTimestamp" in walk) {
      tsMs = tsMs ?? toTsMs(walk.messageTimestamp);
    }
  }

  const mediaHost = walk && typeof walk === "object" ? walk : mergedInput;

  /** Reconstrói objeto com key no topo para pickMedia ver message leaf */
  const forPick: Record<string, unknown> = {
    ...mergedInput,
    key: o.key ?? { remoteJid: baseKey.remoteJid, fromMe: baseKey.fromMe, id: baseKey.id },
    message: mediaHost ?? mergedInput.message,
  };

  const media = pickMedia(forPick);

  const finalTs = tsMs ?? Date.now();

  return {
    id: baseKey.id,
    remoteJid: baseKey.remoteJid,
    fromMe: baseKey.fromMe,
    tsMs: finalTs,
    ...media,
  };
}
