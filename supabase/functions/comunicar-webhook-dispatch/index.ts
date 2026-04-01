import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROW_ID = "00000000-0000-0000-0000-000000000001";

const TIPOS_VALIDOS = new Set([
  "transfer_solicitacao",
  "transfer_reserva",
  "grupo_solicitacao",
  "grupo_reserva",
  "motorista_intake",
  "motoristas_cadastrados",
  "geolocalizacao",
]);

const COL: Record<string, string> = {
  transfer_solicitacao: "transfer_solicitacao_url",
  transfer_reserva: "transfer_reserva_url",
  grupo_solicitacao: "grupo_solicitacao_url",
  grupo_reserva: "grupo_reserva_url",
  motorista_intake: "motorista_intake_url",
  motoristas_cadastrados: "motoristas_cadastrados_url",
  geolocalizacao: "geolocalizacao_url",
};

function assertSafeHttps(url: string): string {
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
  return u.toString();
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

    const body = (await req.json()) as { tipo?: string; payload?: unknown };
    const tipo = String(body.tipo || "").trim();
    if (!TIPOS_VALIDOS.has(tipo)) {
      return new Response(JSON.stringify({ error: "tipo de webhook inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const col = COL[tipo];
    if (!col) {
      return new Response(JSON.stringify({ error: "tipo não mapeado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { data: row, error: rowErr } = await supabaseAdmin
      .from("sistema_webhooks_comunicacao")
      .select("*")
      .eq("id", ROW_ID)
      .maybeSingle();

    if (rowErr) {
      console.error(rowErr);
      return new Response(JSON.stringify({ error: "Erro ao ler configuração de webhooks" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!row) {
      return new Response(JSON.stringify({ error: "Configuração de webhooks não encontrada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawUrl = (row as Record<string, unknown>)[col] as string | null | undefined;
    if (!rawUrl?.trim()) {
      return new Response(
        JSON.stringify({
          error:
            "Webhook não configurado para este tipo. O administrador master deve preencher em Admin → Comunicador.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const targetUrl = assertSafeHttps(rawUrl);

    const n8nRes = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.payload ?? {}),
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
