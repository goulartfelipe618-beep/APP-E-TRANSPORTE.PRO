/**
 * Receptor dos webhooks da UAZAPI (messages, messages_update, history).
 * O token da instância chega no corpo e é descartado. Não entra no banco.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizarMensagem, statusUazapi } from "../_shared/uazapiChat.ts";
import { aplicarStatus, gravarMensagens } from "../_shared/uazapiChatStore.ts";

function ok(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 });
  if (req.method !== "POST") return new Response("method", { status: 405 });

  const segredo = new URL(req.url).searchParams.get("k")?.trim() || "";
  if (segredo.length < 32) return new Response("unauthorized", { status: 401 });

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return ok();
    body = parsed as Record<string, unknown>;
  } catch {
    return ok();
  }
  delete body.token;
  delete body.Token;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: dono } = await admin
    .from("uazapi_chat_assinatura")
    .select("user_id")
    .eq("segredo", segredo)
    .maybeSingle();
  const userId = String(dono?.user_id || "");
  if (!userId) return new Response("unauthorized", { status: 401 });

  const tipo = String(body.EventType || "");
  try {
    if (tipo === "messages") {
      const mensagem = normalizarMensagem(body.message);
      if (mensagem) await gravarMensagens(admin, userId, [mensagem]);
    } else if (tipo === "history") {
      const lista = Array.isArray(body.messages) ? body.messages : [];
      const mensagens = lista.map((item) => normalizarMensagem(item)).filter((m) => m != null);
      if (mensagens.length) await gravarMensagens(admin, userId, mensagens);
    } else if (tipo === "messages_update") {
      const event = body.event && typeof body.event === "object" ? (body.event as Record<string, unknown>) : {};
      const ids = Array.isArray(event.MessageIDs) ? event.MessageIDs.filter((id): id is string => typeof id === "string") : [];
      const estado = statusUazapi(body.state) || statusUazapi(event.Type);
      if (String(body.type || "") === "GroupReceipts" && Array.isArray(event.Receipts)) {
        const ranks = ["Played", "Read", "Delivered"] as const;
        let melhor: (typeof ranks)[number] | null = null;
        for (const item of event.Receipts) {
          if (!item || typeof item !== "object") continue;
          const st = statusUazapi((item as { state?: unknown }).state);
          if (st && ranks.includes(st as (typeof ranks)[number]) && (!melhor || ranks.indexOf(st as (typeof ranks)[number]) < ranks.indexOf(melhor))) {
            melhor = st as (typeof ranks)[number];
          }
        }
        if (melhor) await aplicarStatus(admin, userId, ids, melhor);
      } else if (estado) {
        await aplicarStatus(admin, userId, ids, estado);
      }
    }
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  return ok();
});
