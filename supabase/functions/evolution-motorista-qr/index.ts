/**
 * Gera QR Code na Evolution do administrador para a instância do motorista executivo.
 * Credenciais: tabela comunicador_evolution_credenciais (comunicador oficial).
 * Nome da instância: etp-u-{16 chars do user id} — alinhado a instanceNameForUser no app.
 */
import {
  corsHeaders,
  getAuthorizedUserAndCreds,
  instanceNameForUser,
} from "../_shared/evolutionMotorista.ts";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Respostas da Evolution variam por versão: base64, qrcode.base64, qrOrCode (data URL), instance aninhado. */
function extractQrBase64FromEvolutionJson(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const fromQrcode = (q: unknown): string | null => {
    if (!q || typeof q !== "object") return null;
    const b = (q as { base64?: string }).base64;
    return typeof b === "string" && b.length > 40 ? b : null;
  };

  if (typeof o.base64 === "string" && o.base64.length > 40) {
    return o.base64;
  }

  const nested = fromQrcode(o.qrcode);
  if (nested) return nested;

  const qrOrCode = o.qrOrCode;
  if (typeof qrOrCode === "string" && qrOrCode.startsWith("data:image") && qrOrCode.length > 80) {
    return qrOrCode;
  }

  const inst = o.instance;
  if (inst && typeof inst === "object") {
    const io = inst as Record<string, unknown>;
    if (typeof io.base64 === "string" && io.base64.length > 40) return io.base64;
    const iq = fromQrcode(io.qrcode);
    if (iq) return iq;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const inner = extractQrBase64FromEvolutionJson(item);
      if (inner) return inner;
    }
  }

  return null;
}

function evolutionAlreadyConnectedPayload(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  let st = "";
  if (typeof o.state === "string") st = o.state;
  else if (o.instance && typeof o.instance === "object") {
    const s = (o.instance as Record<string, unknown>).state;
    if (typeof s === "string") st = s;
  }
  const s = st.toLowerCase();
  return s === "open" || s.includes("connected");
}

/** Erros “de negócio” da Evolution: HTTP 200 + JSON para o supabase.functions.invoke repassar `detail` ao cliente. */
function evolutionFailureResponse(message: string, detail: string, code?: string) {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = await getAuthorizedUserAndCreds(authHeader, supabaseUrl, anonKey, serviceKey);
    if (!auth.ok) {
      return new Response(auth.body, {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user, baseUrl, apiKey: rawKey } = auth;

    const instanceName = instanceNameForUser(user.id);

    const root = baseUrl.replace(/\/+$/, "");
    const createTarget = `${root}/instance/create`;
    /** Opções Evolution v2: mensagens/grupos/áudio e mídia não bloqueados; sem sync de histórico completo no servidor. */
    const createPayload = {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      rejectCall: false,
      msgCall: "",
      groupsIgnore: true,
      readMessages: true,
      readStatus: true,
      syncFullHistory: false,
    };
    const createRes = await fetch(createTarget, {
      method: "POST",
      headers: {
        apikey: rawKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createPayload),
    });
    const createText = await createRes.text();
    const createTextLower = createText.toLowerCase();
    const createAlreadyInUse = createRes.status === 403 && createTextLower.includes("already in use");
    if (![200, 201, 409].includes(createRes.status) && !createAlreadyInUse) {
      return evolutionFailureResponse(
        `Evolution recusou criar a instância (${createRes.status}).`,
        createText,
        "evolution_create",
      );
    }

    let b64: string | null = null;
    try {
      const createJson = JSON.parse(createText) as unknown;
      b64 = extractQrBase64FromEvolutionJson(createJson);
    } catch {
      /* create pode vir vazio ou não-JSON em alguns proxies */
    }

    if (b64) {
      return new Response(JSON.stringify({ base64: b64, instanceName }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connectTarget = `${root}/instance/connect/${encodeURIComponent(instanceName)}`;
    const delaysMs = [0, 900, 1600];
    let lastConnectText = "";
    let lastConnectStatus = 0;

    for (const wait of delaysMs) {
      if (wait > 0) await sleep(wait);

      const connectRes = await fetch(connectTarget, {
        method: "GET",
        headers: { apikey: rawKey },
      });
      lastConnectText = await connectRes.text();
      lastConnectStatus = connectRes.status;

      if (connectRes.status < 200 || connectRes.status >= 300) {
        continue;
      }

      let data: unknown;
      try {
        data = JSON.parse(lastConnectText) as unknown;
      } catch {
        continue;
      }

      if (evolutionAlreadyConnectedPayload(data)) {
        return evolutionFailureResponse(
          "Esta instância já está conectada ao WhatsApp.",
          "Desligue o aparelho em Aparelhos ligados ou remova a instância antes de gerar um novo QR.",
          "already_connected",
        );
      }

      b64 = extractQrBase64FromEvolutionJson(data);
      if (b64) break;
    }

    if (!b64 && (lastConnectStatus < 200 || lastConnectStatus >= 300)) {
      return evolutionFailureResponse(
        "Evolution não retornou o QR (connect).",
        `${lastConnectStatus}: ${lastConnectText.slice(0, 500)}`,
        "evolution_connect_http",
      );
    }

    if (!b64) {
      return evolutionFailureResponse(
        "QR Code não veio na resposta da Evolution.",
        `Última resposta connect (${lastConnectStatus}): ${lastConnectText.slice(0, 700)}`,
        "evolution_no_qr",
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
