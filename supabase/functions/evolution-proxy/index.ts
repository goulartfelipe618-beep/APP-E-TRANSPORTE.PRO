import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function assertSafeHttpsBase(url: string): string {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    throw new Error("URL inválida");
  }
  if (u.protocol !== "https:") {
    throw new Error("Apenas HTTPS é permitido");
  }
  const h = u.hostname;
  if (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h.startsWith("127.") ||
    h.startsWith("10.") ||
    h.startsWith("192.168.") ||
    h.endsWith(".local")
  ) {
    throw new Error("Host não permitido");
  }
  return `${u.protocol}//${u.host}`;
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

    const body = await req.json() as {
      baseUrl?: string;
      apiKey?: string;
      path?: string;
      method?: string;
      jsonBody?: unknown;
    };

    const baseUrl = assertSafeHttpsBase(String(body.baseUrl || ""));
    const apiKey = String(body.apiKey || "").trim();
    const path = String(body.path || "").startsWith("/") ? String(body.path) : `/${body.path || ""}`;
    const method = (body.method || "GET").toUpperCase();

    if (!apiKey || !path || path === "/") {
      return new Response(JSON.stringify({ error: "baseUrl, apiKey e path são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method !== "GET" && method !== "POST") {
      return new Response(JSON.stringify({ error: "method deve ser GET ou POST" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const target = `${baseUrl.replace(/\/+$/, "")}${path}`;

    const headers: Record<string, string> = {
      apikey: apiKey,
    };
    if (method === "POST" && body.jsonBody !== undefined && body.jsonBody !== null) {
      headers["Content-Type"] = "application/json";
    }

    const init: RequestInit = {
      method,
      headers,
    };
    if (method === "POST" && body.jsonBody !== undefined && body.jsonBody !== null) {
      init.body = JSON.stringify(body.jsonBody);
    }

    const evoRes = await fetch(target, init);
    const bodyText = await evoRes.text();

    return new Response(
      JSON.stringify({
        status: evoRes.status,
        bodyText,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
