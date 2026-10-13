/**
 * CHAT do painel. Lê só a instância UAZAPI da conta autenticada.
 * O token não volta na resposta.
 */
import { corsHeaders, sessaoDoChat } from "../_shared/uazapiChatAuth.ts";
import {
  listaDe,
  lerHistorico,
  mensagensDoHistorico,
  normalizarConversa,
  normalizarMensagem,
  paginacao,
  pedidoHistoricoSeguro,
} from "../_shared/uazapiChat.ts";
import { gravarMensagens } from "../_shared/uazapiChatStore.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  uazapiChatFind,
  uazapiHistorySync,
  uazapiMessageFind,
  uazapiRoot,
  uazapiWebhookAdd,
  uazapiWebhookGet,
} from "../_shared/uazapi.ts";

function headers(): Record<string, string> {
  return {
    ...corsHeaders,
    "Content-Type": "application/json",
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    Vary: "Authorization",
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: headers() });
}

const CONNECTED = /^(open|connected|conectado|online)$/i;

function inteiro(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

async function umaVez<T extends { status: number }>(run: () => Promise<T>): Promise<T> {
  const first = await run();
  if (first.status !== 429 && first.status < 500) return first;
  await new Promise((r) => setTimeout(r, 400));
  return await run();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = await sessaoDoChat(authHeader, supabaseUrl, anonKey, serviceKey);
    if (!auth.ok) return new Response(auth.body, { status: auth.status, headers: headers() });

    const { userId, baseUrl, admin: supabaseAdmin, token } = auth;
    const { data: ownRow } = await supabaseAdmin
      .from("comunicadores_evolution")
      .select("connection_status, telefone_conectado")
      .eq("escopo", "usuario")
      .eq("user_id", userId)
      .maybeSingle();
    const conectado = Boolean(
      token &&
        (ownRow?.telefone_conectado?.trim() || CONNECTED.test(String(ownRow?.connection_status || ""))),
    );
    if (!token || !conectado) {
      return json({ ok: false, code: "not_connected", error: "WhatsApp desta conta não está conectado." });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || "").trim();
    const root = uazapiRoot(baseUrl);

    if (action === "conversas") {
      const limit = inteiro(body.limit, 1, 100, 50);
      const offset = inteiro(body.offset, 0, 5000, 0);
      const pack = await umaVez(() =>
        uazapiChatFind(root, token, {
          operator: "AND",
          sort: "-wa_lastMsgTimestamp",
          limit,
          offset,
          compact: true,
        }),
      );
      const chats = listaDe(pack.json, "chats").map(normalizarConversa).filter((c) => c != null);
      const page = paginacao(pack.json);
      return json({
        ok: pack.status >= 200 && pack.status < 300,
        httpStatus: pack.status,
        chats,
        hasMore: page.hasMore,
        nextOffset: page.nextOffset,
        error: pack.status >= 200 && pack.status < 300 ? undefined : "A UAZAPI não devolveu as conversas.",
      });
    }

    if (action === "mensagens") {
      const chatid = String(body.chatid || "").trim();
      if (!chatid || chatid.length > 200) return json({ error: "chatid é obrigatório" }, 400);
      const limit = inteiro(body.limit, 1, 100, 50);
      const offset = inteiro(body.offset, 0, 20000, 0);
      const pack = await umaVez(() => uazapiMessageFind(root, token, { chatid, limit, offset }));
      const brutas = listaDe(pack.json, "messages");
      const messages = brutas.map((m) => normalizarMensagem(m, chatid)).filter((m) => m != null);
      try {
        await gravarMensagens(supabaseAdmin, userId, messages);
      } catch {
        /* a lista da API continua valendo mesmo se o espelho falhar */
      }
      const page = paginacao(pack.json);
      return json({
        ok: pack.status >= 200 && pack.status < 300,
        httpStatus: pack.status,
        messages,
        hasMore: page.hasMore,
        nextOffset: page.nextOffset,
        error: pack.status >= 200 && pack.status < 300 ? undefined : "A UAZAPI não devolveu as mensagens.",
      });
    }

    if (action === "historico") {
      const chatid = String(body.chatid || "").trim();
      if (!chatid || chatid.length > 200) return json({ error: "chatid é obrigatório" }, 400);
      const pedido = pedidoHistoricoSeguro(body.next, chatid) || {
        number: chatid,
        count: inteiro(body.count, 1, 100, 50),
      };
      const pack = await uazapiHistorySync(root, token, { ...pedido, sync: true, timeoutMs: 20000 });
      const historico = lerHistorico(pack.json, chatid);
      if (pack.status === 202 && !historico.status) {
        historico.status = "pending";
        historico.timedOut = true;
      }
      const messages = mensagensDoHistorico(pack.json)
        .map((m) => normalizarMensagem(m, chatid))
        .filter((m) => m != null);
      try {
        await gravarMensagens(supabaseAdmin, userId, messages);
      } catch {
        /* idem */
      }
      return json({
        ok: pack.status === 200 || pack.status === 202,
        httpStatus: pack.status,
        messages,
        historico,
        error:
          pack.status === 200 || pack.status === 202
            ? undefined
            : "A UAZAPI não concluiu o pedido de histórico.",
      });
    }

    if (action === "eventos") {
      const aviso = await garantirWebhook(supabaseAdmin, userId, root, token, supabaseUrl, anonKey);
      return json({ ok: aviso == null, error: aviso || undefined });
    }

    return json({ error: "action inválida" }, 400);
  } catch {
    return json({ error: "Falha ao consultar a UAZAPI." }, 500);
  }
});

async function garantirWebhook(
  supabaseAdmin: SupabaseClient,
  userId: string,
  root: string,
  token: string,
  supabaseUrl: string,
  anonKey: string,
): Promise<string | null> {
  const { data: row } = await supabaseAdmin
    .from("uazapi_chat_assinatura")
    .select("segredo")
    .eq("user_id", userId)
    .maybeSingle();
  let segredo = String(row?.segredo || "");
  if (!segredo) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    segredo = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabaseAdmin.from("uazapi_chat_assinatura").insert({ user_id: userId, segredo });
    if (error) return "Não foi possível registrar o recebimento de eventos.";
  }
  const url = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/uazapi-chat-hook?k=${segredo}&apikey=${encodeURIComponent(anonKey)}`;
  const atual = await uazapiWebhookGet(root, token);
  if (atual.status < 200 || atual.status >= 300) return "Não foi possível ler os webhooks atuais.";
  const bruto = atual.json;
  const lista = Array.isArray(bruto)
    ? bruto
    : bruto && typeof bruto === "object" && Array.isArray((bruto as { webhooks?: unknown }).webhooks)
      ? (bruto as { webhooks: unknown[] }).webhooks
      : [];
  const ja = lista.some((item) => {
    if (!item || typeof item !== "object") return false;
    return String((item as { url?: string }).url || "").includes(`/uazapi-chat-hook?k=${segredo}`);
  });
  if (ja) return null;
  const add = await uazapiWebhookAdd(root, token, {
    action: "add",
    enabled: true,
    url,
    events: ["messages", "messages_update", "history", "chats"],
    excludeMessages: [],
  });
  if (add.status < 200 || add.status >= 300) return "A UAZAPI não aceitou o webhook de eventos.";
  return null;
}
