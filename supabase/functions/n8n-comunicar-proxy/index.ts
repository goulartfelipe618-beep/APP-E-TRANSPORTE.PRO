import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const DEFAULT_WEBHOOK =
  "https://n8n.e-transporte.pro/webhook/7ed2848a-93d3-4659-a271-8bfc2f10ec77";

function allowedWebhookUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    throw new Error("URL do webhook inválida");
  }
  if (u.protocol !== "https:") throw new Error("Apenas HTTPS");
  if (u.hostname !== "n8n.e-transporte.pro") {
    throw new Error("Host do webhook não permitido");
  }
  if (!u.pathname.startsWith("/webhook/")) {
    throw new Error("Caminho do webhook inválido");
  }
  return u.toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
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

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as { payload?: unknown; webhookUrl?: string };

    const envUrl = Deno.env.get("N8N_COMUNICAR_WEBHOOK_URL")?.trim();
    const rawTarget =
      typeof body.webhookUrl === "string" && body.webhookUrl.trim()
        ? body.webhookUrl.trim()
        : envUrl || DEFAULT_WEBHOOK;

    const targetUrl = allowedWebhookUrl(rawTarget);

    if (body.payload === undefined || body.payload === null) {
      return new Response(JSON.stringify({ error: "payload é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const n8nRes = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.payload),
    });

    const ok = n8nRes.ok;
    const status = n8nRes.status;

    return new Response(JSON.stringify({ ok, status }), {
      status: ok ? 200 : 502,
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
