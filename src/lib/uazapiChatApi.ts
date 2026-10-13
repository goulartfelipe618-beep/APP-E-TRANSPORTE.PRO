import { supabase } from "@/integrations/supabase/client";
import type { ChatConversa, ChatMensagem, HistoricoPedido, StatusUazapi } from "../../supabase/functions/_shared/uazapiChat";

export type { ChatConversa, ChatMensagem, HistoricoPedido };

type Invoke = {
  ok?: boolean;
  code?: string;
  error?: string;
  chats?: ChatConversa[];
  messages?: ChatMensagem[];
  hasMore?: boolean;
  nextOffset?: number | null;
  historico?: HistoricoPedido;
  message?: ChatMensagem | null;
  fileURL?: string;
  mimetype?: string;
};

async function chamar(body: Record<string, unknown>): Promise<Invoke & { falhaRede?: string }> {
  const { data: sess } = await supabase.auth.getSession();
  const access = sess.session?.access_token;
  if (!access) return { ok: false, falhaRede: "Sessão expirada. Entre novamente." };
  const { data, error } = await supabase.functions.invoke<Invoke>("uazapi-chat", {
    body,
    headers: { Authorization: `Bearer ${access}` },
  });
  if (error) {
    let detail = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const parsed = (await ctx.json()) as { error?: string };
        if (parsed.error) detail = parsed.error;
      }
    } catch {
      /* corpo vazio */
    }
    return { ok: false, falhaRede: detail };
  }
  return data || { ok: false, falhaRede: "Resposta vazia da UAZAPI." };
}

export function listarConversas(offset = 0) {
  return chamar({ action: "conversas", limit: 50, offset });
}

export function listarMensagens(chatid: string, offset = 0) {
  return chamar({ action: "mensagens", chatid, limit: 50, offset });
}

export function enviarTexto(chatid: string, text: string) {
  return chamar({ action: "enviar", kind: "text", chatid, text });
}

export function enviarMidia(
  chatid: string,
  type: "image" | "video" | "audio" | "document" | "sticker",
  file: string,
  extra: { text?: string; docName?: string; mimetype?: string },
) {
  return chamar({ action: "enviar", kind: "media", chatid, type, file, ...extra });
}

export function baixarArquivo(id: string) {
  return chamar({ action: "arquivo", id });
}

export function ligarEventos() {
  return chamar({ action: "eventos" });
}

export function linhaParaMensagem(row: Record<string, unknown>): ChatMensagem | null {
  const chave = typeof row.chave === "string" ? row.chave : "";
  const chatid = typeof row.chatid === "string" ? row.chatid : "";
  if (!chave || !chatid) return null;
  const status = typeof row.status === "string" ? row.status : null;
  const conhecidos = ["Queued", "Canceled", "Failed", "Sent", "Delivered", "Read", "Played"];
  return {
    chave,
    id: typeof row.id_uazapi === "string" ? row.id_uazapi : null,
    messageid: typeof row.messageid === "string" ? row.messageid : null,
    chatid,
    fromMe: row.from_me === true || row.from_me === false ? row.from_me : null,
    texto: typeof row.texto === "string" && row.texto.trim() ? row.texto : null,
    tipo: typeof row.tipo === "string" && row.tipo.trim() ? row.tipo : null,
    status: status && conhecidos.includes(status) ? (status as StatusUazapi) : null,
    remetente: typeof row.remetente === "string" ? row.remetente : null,
    remetenteNome: typeof row.remetente_nome === "string" ? row.remetente_nome : null,
    enviadaPelaApi: row.enviada_pela_api === true || row.enviada_pela_api === false ? row.enviada_pela_api : null,
    erro: typeof row.erro === "string" && row.erro.trim() ? row.erro : null,
    timestampMs: typeof row.message_timestamp === "number" ? row.message_timestamp : null,
  };
}

export function mensagemVisivel(m: ChatMensagem): boolean {
  return Boolean(m.texto || m.tipo || m.erro);
}

export const ROTULO_STATUS: Record<StatusUazapi, string> = {
  Queued: "Na fila",
  Canceled: "Cancelada",
  Failed: "Falhou",
  Sent: "Enviada",
  Delivered: "Entregue",
  Read: "Lida",
  Played: "Ouvida",
};
