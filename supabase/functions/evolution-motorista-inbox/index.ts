/**
 * Inbox do comunicador (chats/mensagens/envio) via UAZAPI.
 * Credenciais só no servidor; usa o token da instância do utilizador.
 */
import {
  corsHeaders,
  getAuthorizedUserAndCreds,
  loadStoredInstanceToken,
} from "../_shared/evolutionMotorista.ts";
import {
  instanceHeaders,
  uazapiChatFind,
  uazapiFetch,
  uazapiMessageFind,
  uazapiRoot,
  uazapiSendMedia,
  uazapiSendText,
} from "../_shared/uazapi.ts";

function privateJsonHeaders(): Record<string, string> {
  return {
    ...corsHeaders,
    "Content-Type": "application/json",
    "Cache-Control": "private, no-store, max-age=0",
    "Pragma": "no-cache",
    "Vary": "Authorization",
  };
}

const MAX_BODY_CHARS = 500_000;
const CONNECTED_ROW = /^(open|connected|conectado|online)$/i;

function isUsuarioRowConnected(status: string | null | undefined, phone: string | null | undefined): boolean {
  if (phone?.trim()) return true;
  const s = (status ?? "").trim();
  return CONNECTED_ROW.test(s);
}

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function normalizeChatsArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const a = o.data ?? o.chats ?? o.records;
    if (Array.isArray(a)) return a;
  }
  return [];
}

function normalizeMessagesArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const a = o.data ?? o.messages ?? o.records;
    if (Array.isArray(a)) return a;
  }
  return [];
}

function clip(text: string): string {
  return text.length > MAX_BODY_CHARS ? text.slice(0, MAX_BODY_CHARS) + "\n…" : text;
}

function mapMediaType(mediatype: string, mimetype: string): string {
  const t = mediatype.toLowerCase();
  if (t.includes("image") || mimetype.startsWith("image/")) return "image";
  if (t.includes("video") || mimetype.startsWith("video/")) return "video";
  if (t.includes("audio") || mimetype.startsWith("audio/")) return "audio";
  return "document";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: privateJsonHeaders(),
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: privateJsonHeaders(),
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = await getAuthorizedUserAndCreds(authHeader, supabaseUrl, anonKey, serviceKey);
    if (!auth.ok) {
      return new Response(auth.body, {
        status: 200,
        headers: privateJsonHeaders(),
      });
    }

    const { user, baseUrl, supabaseAdmin } = auth;
    const root = uazapiRoot(baseUrl);
    const token = await loadStoredInstanceToken(supabaseAdmin, "own", user.id);

    const { data: ownRow, error: ownErr } = await supabaseAdmin
      .from("comunicadores_evolution")
      .select("connection_status, telefone_conectado")
      .eq("escopo", "usuario")
      .eq("user_id", user.id)
      .maybeSingle();

    if (ownErr) {
      return new Response(JSON.stringify({ error: "Erro ao ler comunicador do utilizador." }), {
        status: 500,
        headers: privateJsonHeaders(),
      });
    }

    if (!token || !isUsuarioRowConnected(ownRow?.connection_status ?? null, ownRow?.telefone_conectado ?? null)) {
      return new Response(JSON.stringify({ error: "WhatsApp próprio não conectado.", code: "not_connected" }), {
        status: 403,
        headers: privateJsonHeaders(),
      });
    }

    const body = (await req.json()) as {
      action?: string;
      remoteJid?: string;
      text?: string;
      number?: string;
      messageId?: string;
      fromMe?: boolean;
      participant?: string;
      media?: {
        base64: string;
        mimetype: string;
        fileName: string;
        mediatype: string;
        caption?: string;
      };
      audioBase64?: string;
      limit?: number;
    };

    const action = String(body.action || "").trim();
    if (!action) {
      return new Response(JSON.stringify({ error: "action é obrigatório" }), {
        status: 400,
        headers: privateJsonHeaders(),
      });
    }

    if (action === "chats") {
      const pack = await uazapiChatFind(root, token, { limit: 80 });
      const parsed = pack.json ?? parseJsonSafe(pack.text);
      return new Response(
        JSON.stringify({
          httpStatus: pack.status,
          raw: parsed !== null ? parsed : pack.text,
          chats: normalizeChatsArray(parsed),
        }),
        { status: 200, headers: privateJsonHeaders() },
      );
    }

    if (action === "messages") {
      const remoteJid = String(body.remoteJid || "").trim();
      if (!remoteJid) {
        return new Response(JSON.stringify({ error: "remoteJid é obrigatório" }), {
          status: 400,
          headers: privateJsonHeaders(),
        });
      }
      const limit = Math.min(Math.max(Number(body.limit) || 80, 1), 200);
      let pack = await uazapiMessageFind(root, token, { id: remoteJid, chatid: remoteJid, limit });
      if (pack.status < 200 || pack.status >= 300) {
        pack = await uazapiMessageFind(root, token, { chatid: remoteJid, limit });
      }
      const parsed = pack.json ?? parseJsonSafe(pack.text);
      return new Response(
        JSON.stringify({
          httpStatus: pack.status,
          raw: parsed !== null ? parsed : pack.text,
          messages: normalizeMessagesArray(parsed),
        }),
        { status: 200, headers: privateJsonHeaders() },
      );
    }

    if (action === "send_text") {
      const text = String(body.text || "").trim();
      const num = String(body.number || "").replace(/\D/g, "");
      if (!text || !num || num.length < 10) {
        return new Response(JSON.stringify({ error: "text e number (E.164) são obrigatórios" }), {
          status: 400,
          headers: privateJsonHeaders(),
        });
      }
      const pack = await uazapiSendText(root, token, num, text);
      return new Response(JSON.stringify({ httpStatus: pack.status, bodyText: clip(pack.text) }), {
        status: 200,
        headers: privateJsonHeaders(),
      });
    }

    if (action === "send_media") {
      const m = body.media;
      const num = String(body.number || "").replace(/\D/g, "");
      if (!m?.base64 || !m.mimetype || !m.fileName || !m.mediatype || !num || num.length < 10) {
        return new Response(JSON.stringify({ error: "media e number inválidos" }), {
          status: 400,
          headers: privateJsonHeaders(),
        });
      }
      const raw = m.base64.includes(",") ? m.base64 : `data:${m.mimetype};base64,${m.base64}`;
      const pack = await uazapiSendMedia(root, token, num, {
        type: mapMediaType(m.mediatype, m.mimetype),
        file: raw,
        text: m.caption ?? "",
        docName: m.fileName,
      });
      return new Response(JSON.stringify({ httpStatus: pack.status, bodyText: clip(pack.text) }), {
        status: 200,
        headers: privateJsonHeaders(),
      });
    }

    if (action === "send_audio") {
      const num = String(body.number || "").replace(/\D/g, "");
      const audio = String(body.audioBase64 || "").trim();
      if (!audio || !num || num.length < 10) {
        return new Response(JSON.stringify({ error: "audioBase64 e number são obrigatórios" }), {
          status: 400,
          headers: privateJsonHeaders(),
        });
      }
      const file = audio.includes(",") ? audio : `data:audio/ogg;base64,${audio}`;
      const pack = await uazapiSendMedia(root, token, num, {
        type: "audio",
        file,
      });
      return new Response(JSON.stringify({ httpStatus: pack.status, bodyText: clip(pack.text) }), {
        status: 200,
        headers: privateJsonHeaders(),
      });
    }

    if (action === "delete_for_everyone") {
      const remoteJid = String(body.remoteJid || "").trim();
      const messageId = String(body.messageId || "").trim();
      const fromMe = body.fromMe === true;
      if (!remoteJid || !messageId) {
        return new Response(JSON.stringify({ error: "remoteJid e messageId são obrigatórios" }), {
          status: 400,
          headers: privateJsonHeaders(),
        });
      }
      if (!fromMe) {
        return new Response(
          JSON.stringify({
            error: "Só é possível apagar para todas as pessoas as mensagens que você enviou.",
            code: "delete_for_others_denied",
          }),
          {
            status: 400,
            headers: privateJsonHeaders(),
          },
        );
      }
      const pack = await uazapiFetch(`${root}/message/delete`, {
        method: "POST",
        headers: instanceHeaders(token, true),
        body: JSON.stringify({ id: messageId, chatid: remoteJid }),
      });
      return new Response(JSON.stringify({ httpStatus: pack.status, bodyText: clip(pack.text) }), {
        status: 200,
        headers: privateJsonHeaders(),
      });
    }

    return new Response(JSON.stringify({ error: "action desconhecido" }), {
      status: 400,
      headers: privateJsonHeaders(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: privateJsonHeaders(),
    });
  }
});
