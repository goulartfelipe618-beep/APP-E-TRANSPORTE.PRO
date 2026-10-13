/**
 * Aviso de mensagem nova. Não grava texto, imagem nem arquivo.
 * O painel só recebe um sinal vazio e busca o conteúdo na UAZAPI.
 */
const AVISOS = new Set(["messages", "messages_update", "chats", "message", "chat"]);
const contas = new Map<string, { userId: string; ate: number }>();
const ultimoAviso = new Map<string, number>();

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
  if (segredo.length < 32 || segredo.length > 80) return new Response("unauthorized", { status: 401 });

  let tipo = "";
  try {
    const body = await req.json();
    if (body && typeof body === "object") {
      const o = body as Record<string, unknown>;
      tipo = String(o.EventType || o.event || o.type || "").toLowerCase();
    }
  } catch {
    tipo = "";
  }
  if (tipo === "history" || (tipo && !AVISOS.has(tipo))) return ok();

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return ok();

  const agora = Date.now();
  let userId = "";
  const guardada = contas.get(segredo);
  if (guardada && guardada.ate > agora) userId = guardada.userId;
  if (!userId) {
    const busca = await fetch(
      `${supabaseUrl}/rest/v1/uazapi_chat_assinatura?segredo=eq.${encodeURIComponent(segredo)}&select=user_id`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (!busca.ok) return ok();
    const linhas = (await busca.json()) as { user_id?: string }[];
    userId = String(linhas[0]?.user_id || "");
    if (!userId) return ok();
    contas.set(segredo, { userId, ate: agora + 10 * 60 * 1000 });
  }

  const recente = ultimoAviso.get(userId) ?? 0;
  if (agora - recente < 2000) return ok();
  ultimoAviso.set(userId, agora);

  await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        { topic: `chat-aviso:${userId}`, event: "nova", payload: {} },
        { topic: `realtime:chat-aviso:${userId}`, event: "nova", payload: {} },
      ],
    }),
  }).catch(() => undefined);

  return ok();
});
