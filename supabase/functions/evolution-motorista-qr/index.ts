/**
 * Cria instância na plataforma (create-instance-url) se ainda não existir e devolve o QR.
 * Token da plataforma só no secret do servidor.
 */
import {
  corsHeaders,
  createInstanceViaPlatform,
  getAuthorizedUserAndCreds,
  loadPlatformCreateToken,
  loadStoredInstanceToken,
  parseUazapiTarget,
  persistUazapiInstanceToken,
} from "../_shared/evolutionMotorista.ts";
import {
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
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user, baseUrl, supabaseAdmin, instanceName } = auth;
    let token = await loadStoredInstanceToken(supabaseAdmin, target, user.id);
    let resolvedName = instanceName;

    if (!token) {
      const platformToken = await loadPlatformCreateToken(supabaseAdmin);
      const names = [instanceName, `${instanceName}-${Date.now().toString(36).slice(-6)}`];
      let lastCreateErr = "";
      for (const name of names) {
        try {
          const created = await createInstanceViaPlatform({
            name,
            deviceName: "E-Transporte.pro",
            platformToken,
          });
          token = created.instanceToken;
          resolvedName = created.instanceName || name;
          lastCreateErr = "";
          break;
        } catch (e) {
          lastCreateErr = e instanceof Error ? e.message : String(e);
        }
      }
      if (!token) {
        return failureResponse("Não foi possível criar a instância UAZAPI.", lastCreateErr, "uazapi_create");
      }
    }

    const root = uazapiRoot(baseUrl);

    await persistUazapiInstanceToken(supabaseAdmin, {
      target,
      userId: user.id,
      instanceName: resolvedName,
      token,
      extra: { connection_status: "aguardando_qr" },
    });

    const delaysMs = [0, 800, 1600];
    let lastText = "";
    let lastStatus = 0;
    let b64: string | null = null;

    for (const wait of delaysMs) {
      if (wait > 0) await sleep(wait);

      const st = await uazapiStatus(root, token);
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

      const conn = await uazapiConnectQr(root, token);
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
      if (b64) break;
    }

    if (!b64) {
      return failureResponse(
        "UAZAPI não retornou o QR Code.",
        `Última resposta (${lastStatus}): ${lastText.slice(0, 700)}`,
        "uazapi_no_qr",
      );
    }

    await persistUazapiInstanceToken(supabaseAdmin, {
      target,
      userId: user.id,
      instanceName: resolvedName,
      token,
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
