/**
 * Gera QR Code na Evolution do administrador para a instância do motorista executivo.
 * Credenciais: tabela comunicador_evolution_credenciais (comunicador oficial).
 * Nome da instância: etp-u-{16 chars do user id} — alinhado a instanceNameForUser no app.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
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

function instanceNameForUser(userId: string): string {
  return `etp-u-${userId.replace(/-/g, "").slice(0, 16)}`;
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

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: roleRows, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (roleErr) {
      return new Response(JSON.stringify({ error: "Não foi possível verificar permissões." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowed = (roleRows || []).some(
      (r: { role: string }) => r.role === "admin_transfer" || r.role === "admin_master",
    );
    if (!allowed) {
      return new Response(
        JSON.stringify({
          error: "Apenas contas de motorista executivo (ou administrador) podem gerar este QR.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: sistemaRow, error: sysErr } = await supabaseAdmin
      .from("comunicadores_evolution")
      .select("id")
      .eq("escopo", "sistema")
      .maybeSingle();

    if (sysErr || !sistemaRow?.id) {
      return new Response(JSON.stringify({ error: "Comunicador oficial não encontrado no banco." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: credsRow, error: credsErr } = await supabaseAdmin
      .from("comunicador_evolution_credenciais")
      .select("api_url, api_key")
      .eq("comunicador_id", sistemaRow.id)
      .maybeSingle();

    if (credsErr) {
      return new Response(JSON.stringify({ error: "Erro ao ler credenciais da Evolution." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawUrl = credsRow?.api_url?.trim() || "";
    const rawKey = credsRow?.api_key?.trim() || "";
    if (!rawUrl || !rawKey) {
      return new Response(
        JSON.stringify({
          error:
            "Evolution API não configurada pelo administrador. No painel Admin → Comunicador, informe a URL HTTPS e a API Key do servidor Evolution.",
          code: "missing_evolution_creds",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseUrl = assertSafeHttpsBase(rawUrl);
    const instanceName = instanceNameForUser(user.id);

    const createTarget = `${baseUrl.replace(/\/+$/, "")}/instance/create`;
    const createRes = await fetch(createTarget, {
      method: "POST",
      headers: {
        apikey: rawKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });
    const createText = await createRes.text();
    if (![200, 201, 409].includes(createRes.status)) {
      return new Response(
        JSON.stringify({
          error: `Evolution recusou criar a instância (${createRes.status}).`,
          detail: createText.slice(0, 400),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const connectTarget =
      `${baseUrl.replace(/\/+$/, "")}/instance/connect/${encodeURIComponent(instanceName)}`;
    const connectRes = await fetch(connectTarget, {
      method: "GET",
      headers: { apikey: rawKey },
    });
    const connectText = await connectRes.text();

    if (connectRes.status < 200 || connectRes.status >= 300) {
      return new Response(
        JSON.stringify({
          error: "Evolution não retornou o QR (connect).",
          detail: connectText.slice(0, 400),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(connectText) as Record<string, unknown>;
    } catch {
      return new Response(JSON.stringify({ error: "Resposta inválida da Evolution (JSON)." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const b64 =
      (typeof data.base64 === "string" && data.base64) ||
      (typeof (data as { qrcode?: { base64?: string } }).qrcode?.base64 === "string" &&
        (data as { qrcode: { base64: string } }).qrcode.base64) ||
      null;

    if (!b64) {
      return new Response(
        JSON.stringify({
          error: "QR Code não veio na resposta da Evolution.",
          detail: connectText.slice(0, 500),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ base64: b64, instanceName }), {
      status: 200,
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
