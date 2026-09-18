/**
 * Gera QR Code na uazapiGO (admin token + token da instância).
 */
import {
  corsHeaders,
  ensureUazapiInstanceToken,
  getAuthorizedUserAndCreds,
  loadStoredInstanceToken,
  parseUazapiTarget,
  persistUazapiInstanceToken,
  assertPlatformInstanceAvailable,
} from "../_shared/evolutionMotorista.ts";
import {
  extractUazapiName,
  extractUazapiQrBase64,
  extractUazapiStatus,
  isUazapiConnected,
  uazapiConnectQr,
  uazapiRoot,
  uazapiStatus,
} from "../_shared/uazapi.ts";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function failureResponse(message: string, detail: string, code?: string) {
  return new Response(
    JSON.stringify({
      error: message,
      detail: detail.slice(0, 800),
      ...(code ? { code } : {}),
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
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

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const target = parseUazapiTarget(body);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = await getAuthorizedUserAndCreds(authHeader, supabaseUrl, anonKey, serviceKey, target);
    if (!auth.ok) {
      return new Response(auth.body, {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user, baseUrl, apiKey: adminToken, supabaseAdmin, instanceName } = auth;
    const root = uazapiRoot(baseUrl);

    const stored = await loadStoredInstanceToken(supabaseAdmin, target, user.id);
    let ensured;
    try {
      ensured = await ensureUazapiInstanceToken(root, adminToken, instanceName, stored);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return failureResponse("UAZAPI recusou criar a instância.", msg, "uazapi_init");
    }

    if (ensured.token === adminToken) {
      try {
        await assertPlatformInstanceAvailable(supabaseAdmin, ensured.token, user.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return failureResponse(msg, "Use um Admin Token para criar instâncias adicionais.", "uazapi_instance_claimed");
      }
    }

    const resolvedName = extractUazapiName(ensured.initJson) || instanceName;

    await persistUazapiInstanceToken(supabaseAdmin, {
      target,
      userId: user.id,
      instanceName: resolvedName,
      token: ensured.token,
      extra: { connection_status: "aguardando_qr" },
    });

    if (target === "own" && ensured.token === adminToken) {
      const sistemaTok = await loadStoredInstanceToken(supabaseAdmin, "sistema", user.id);
      if (!sistemaTok) {
        await persistUazapiInstanceToken(supabaseAdmin, {
          target: "sistema",
          userId: user.id,
          instanceName: resolvedName,
          token: ensured.token,
          extra: { connection_status: "aguardando_qr" },
        });
      }
    }

    let b64 = extractUazapiQrBase64(ensured.initJson);

    const delaysMs = [0, 800, 1600];
    let lastText = "";
    let lastStatus = 0;

    for (const wait of delaysMs) {
      if (b64) break;
      if (wait > 0) await sleep(wait);

      const st = await uazapiStatus(root, ensured.token);
      lastStatus = st.status;
      lastText = st.text;
      if (isUazapiConnected(extractUazapiStatus(st.json))) {
        return failureResponse(
          "Esta instância já está conectada ao WhatsApp.",
          "Desconecte antes de gerar um novo QR.",
          "already_connected",
        );
      }
      b64 = extractUazapiQrBase64(st.json);
      if (b64) break;

      const conn = await uazapiConnectQr(root, ensured.token);
      lastStatus = conn.status;
      lastText = conn.text;
      if (isUazapiConnected(extractUazapiStatus(conn.json))) {
        return failureResponse(
          "Esta instância já está conectada ao WhatsApp.",
          "Desconecte antes de gerar um novo QR.",
          "already_connected",
        );
      }
      b64 = extractUazapiQrBase64(conn.json);
    }

    if (!b64) {
      return failureResponse(
        "UAZAPI não retornou o QR Code.",
        `Última resposta (${lastStatus}): ${lastText.slice(0, 700)}`,
        "evolution_no_qr",
      );
    }

    await persistUazapiInstanceToken(supabaseAdmin, {
      target,
      userId: user.id,
      instanceName: extractUazapiName(ensured.initJson) || resolvedName,
      token: ensured.token,
      extra: { qr_code_base64: b64, connection_status: "aguardando_qr" },
    });

    return new Response(JSON.stringify({ base64: b64, instanceName: resolvedName }), {
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
