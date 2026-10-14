/**
 * Abre o QR da instância desta conta. Se ela ainda não tiver uma instância exclusiva,
 * cria uma nova na UAZAPI sem listar, apagar ou reconectar as instâncias das outras contas.
 */
import {
  corsHeaders,
  createInstanceViaPlatform,
  getAuthorizedUserAndCreds,
  loadPlatformCreateToken,
  loadStoredInstanceToken,
  parseUazapiTarget,
  persistUazapiInstanceToken,
  tokenJaUsadoPorOutraConta,
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

function tokenRecusado(status: number, text: string): boolean {
  return status === 401 && /invalid token/i.test(text);
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
    let root = uazapiRoot(baseUrl);

    if (token) {
      const probe = await uazapiStatus(root, token);
      if (tokenRecusado(probe.status, probe.text)) token = null;
    }

    const abrirInstanciaDestaConta = async () => {
      const platformToken = await loadPlatformCreateToken(supabaseAdmin);
      const name = `${instanceName}-${Date.now().toString(36).slice(-6)}`;
      const created = await createInstanceViaPlatform({
        name,
        deviceName: "E-Transporte.pro",
        platformToken,
        serverUrl: root,
        ownerUserId: target === "own" ? user.id : "",
      });
      if (
        target === "own" &&
        (await tokenJaUsadoPorOutraConta(supabaseAdmin, created.instanceToken, user.id))
      ) {
        throw new Error("A instância devolvida já pertence a outra conta. Nada foi alterado.");
      }
      token = created.instanceToken;
      resolvedName = created.instanceName || name;
      root = uazapiRoot(created.serverUrl || baseUrl);
    };

    if (!token) {
      try {
        await abrirInstanciaDestaConta();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return failureResponse("Não foi possível criar a instância UAZAPI.", msg, "uazapi_create");
      }
    }

    if (!token) {
      return failureResponse("Não foi possível criar a instância UAZAPI.", "Sem token da conta.", "uazapi_create");
    }

    await persistUazapiInstanceToken(supabaseAdmin, {
      target,
      userId: user.id,
      instanceName: resolvedName,
      token,
      serverUrl: root,
      extra: { connection_status: "aguardando_qr" },
    });

    const delaysMs = [0, 900, 1800];
    let lastText = "";
    let lastStatus = 0;
    let b64: string | null = null;
    let connectStarted = false;
    let recriouToken = false;

    for (const wait of delaysMs) {
      if (wait > 0) await sleep(wait);

      const st = await uazapiStatus(root, token);
      lastStatus = st.status;
      lastText = st.text;
      if (!recriouToken && tokenRecusado(st.status, st.text)) {
        recriouToken = true;
        token = "";
        await abrirInstanciaDestaConta();
        connectStarted = false;
        await persistUazapiInstanceToken(supabaseAdmin, {
          target,
          userId: user.id,
          instanceName: resolvedName,
          token,
          serverUrl: root,
          extra: { connection_status: "aguardando_qr" },
        });
        continue;
      }
      if (isUazapiConnected(extractUazapiStatus(st.json))) {
        return failureResponse(
          "Esta instância já está conectada ao WhatsApp.",
          "Desconecte antes de gerar um novo QR.",
          "already_connected",
        );
      }
      b64 = extractUazapiQrBase64(st.json);
      if (b64) break;

      if (connectStarted) continue;
      connectStarted = true;
      const conn = await uazapiConnectQr(root, token);
      lastStatus = conn.status;
      lastText = conn.text;
      if (!recriouToken && tokenRecusado(conn.status, conn.text)) {
        recriouToken = true;
        await abrirInstanciaDestaConta();
        connectStarted = false;
        await persistUazapiInstanceToken(supabaseAdmin, {
          target,
          userId: user.id,
          instanceName: resolvedName,
          token,
          serverUrl: root,
          extra: { connection_status: "aguardando_qr" },
        });
        continue;
      }
      if (conn.status === 409) continue;
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
      serverUrl: root,
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
