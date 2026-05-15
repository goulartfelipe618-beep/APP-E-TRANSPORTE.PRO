/**
 * Evolution — inbox do motorista (chats/mensagens/envio texto, ficheiros, áudio).
 * Credenciais só no servidor (comunicador oficial); usa a instância etp-u-* do utilizador.
 */
import {
  corsHeaders,
  getAuthorizedUserAndCreds,
  instanceNameForUser,
} from "../_shared/evolutionMotorista.ts";

const MAX_BODY_CHARS = 500_000;
const CONNECTED_ROW = /^(open|connected|conectado|online)$/i;

function isUsuarioRowConnected(status: string | null | undefined, phone: string | null | undefined): boolean {
  if (phone?.trim()) return true;
  const s = (status ?? "").trim();
  return CONNECTED_ROW.test(s);
}

async function evolutionPost(root: string, apiKey: string, path: string, jsonBody?: unknown): Promise<{ status: number; text: string }> {
  const url = `${root}${path.startsWith("/") ? path : `/${path}`}`;
  const init: RequestInit = {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(jsonBody ?? {}),
  };
  const res = await fetch(url, init);
  const text = await res.text();
  return { status: res.status, text: text.length > MAX_BODY_CHARS ? text.slice(0, MAX_BODY_CHARS) + "\n…" : text };
}

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Extrai array de chats de várias formas de resposta Evolution. */
function normalizeChatsArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const a = o.data ?? o.chats ?? o.records;
    if (Array.isArray(a)) return a;
  }
  return [];
}

/** Extrai lista de mensagens. */
function normalizeMessagesArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const a = o.data ?? o.messages ?? o.records;
    if (Array.isArray(a)) return a;
  }
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = await getAuthorizedUserAndCreds(authHeader, supabaseUrl, anonKey, serviceKey);
    if (!auth.ok) {
      return new Response(auth.body, {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user, baseUrl, apiKey, supabaseAdmin } = auth;
    const instanceName = instanceNameForUser(user.id);
    const root = baseUrl.replace(/\/+$/, "");

    const { data: ownRow, error: ownErr } = await supabaseAdmin
      .from("comunicadores_evolution")
      .select("connection_status, telefone_conectado")
      .eq("escopo", "usuario")
      .eq("user_id", user.id)
      .maybeSingle();

    if (ownErr) {
      return new Response(JSON.stringify({ error: "Erro ao ler comunicador do utilizador." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isUsuarioRowConnected(ownRow?.connection_status ?? null, ownRow?.telefone_conectado ?? null)) {
      return new Response(JSON.stringify({ error: "WhatsApp próprio não conectado.", code: "not_connected" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as {
      action?: string;
      remoteJid?: string;
      text?: string;
      number?: string;
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encInst = encodeURIComponent(instanceName);

    if (action === "chats") {
      const pack = await evolutionPost(root, apiKey, `/chat/findChats/${encInst}`, {});
      const parsed = parseJsonSafe(pack.text);
      return new Response(
        JSON.stringify({
          httpStatus: pack.status,
          raw: parsed !== null ? parsed : pack.text,
          chats: normalizeChatsArray(parsed),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "messages") {
      const remoteJid = String(body.remoteJid || "").trim();
      if (!remoteJid) {
        return new Response(JSON.stringify({ error: "remoteJid é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const limit = Math.min(Math.max(Number(body.limit) || 80, 1), 200);
      const pack = await evolutionPost(root, apiKey, `/chat/findMessages/${encInst}`, {
        where: { key: { remoteJid } },
        limit,
      });
      const parsed = parseJsonSafe(pack.text);
      return new Response(
        JSON.stringify({
          httpStatus: pack.status,
          raw: parsed !== null ? parsed : pack.text,
          messages: normalizeMessagesArray(parsed),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "send_text") {
      const text = String(body.text || "").trim();
      const num = String(body.number || "").replace(/\D/g, "");
      if (!text || !num || num.length < 10) {
        return new Response(JSON.stringify({ error: "text e number (E.164) são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const pack = await evolutionPost(root, apiKey, `/message/sendText/${encInst}`, {
        number: num,
        text,
        linkPreview: false,
      });
      return new Response(JSON.stringify({ httpStatus: pack.status, bodyText: pack.text }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_media") {
      const m = body.media;
      const num = String(body.number || "").replace(/\D/g, "");
      if (!m?.base64 || !m.mimetype || !m.fileName || !m.mediatype || !num || num.length < 10) {
        return new Response(JSON.stringify({ error: "media e number inválidos" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const pack = await evolutionPost(root, apiKey, `/message/sendMedia/${encInst}`, {
        number: num,
        mediatype: m.mediatype,
        mimetype: m.mimetype,
        caption: m.caption ?? "",
        media: m.base64,
        fileName: m.fileName,
      });
      return new Response(JSON.stringify({ httpStatus: pack.status, bodyText: pack.text }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_audio") {
      const num = String(body.number || "").replace(/\D/g, "");
      const audio = String(body.audioBase64 || "").trim();
      if (!audio || !num || num.length < 10) {
        return new Response(JSON.stringify({ error: "audioBase64 e number são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const pack = await evolutionPost(root, apiKey, `/message/sendWhatsAppAudio/${encInst}`, {
        number: num,
        audio,
        encoding: true,
      });
      return new Response(JSON.stringify({ httpStatus: pack.status, bodyText: pack.text }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "action desconhecido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
