/**
 * Envia Comunicar via UAZAPI POST /send/buttons (fallback /send/text).
 */
import {
  corsHeaders,
  getAuthorizedUserAndCreds,
  loadStoredInstanceToken,
} from "../_shared/evolutionMotorista.ts";
import {
  uazapiRoot,
  uazapiSendButtons,
  uazapiSendDocument,
  uazapiSendText,
} from "../_shared/uazapi.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeNumber(raw: string): string | null {
  let tel = raw.replace(/\D/g, "");
  if (!tel || tel.length < 10) return null;
  if (!tel.startsWith("55")) tel = `55${tel}`;
  return tel;
}

const DEFAULT_BUTTONS = [
  { id: "recebido", text: "✅ Recebido" },
  { id: "duvidas", text: "❓ Dúvidas" },
];

function parseButtons(raw: unknown): Array<{ id: string; text: string }> {
  if (!Array.isArray(raw)) return DEFAULT_BUTTONS;
  const out: Array<{ id: string; text: string }> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = String((item as { id?: unknown }).id || "").trim();
    const text = String((item as { text?: unknown }).text || "").trim();
    if (id && text) out.push({ id: id.slice(0, 80), text: text.slice(0, 24) });
  }
  return out.length ? out.slice(0, 3) : DEFAULT_BUTTONS;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Não autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = (await req.json()) as {
      number?: string;
      text?: string;
      title?: string;
      buttons?: Array<{ id: string; text: string }>;
      pdf?: { base64?: string; filename?: string } | null;
    };

    const number = normalizeNumber(String(body.number || ""));
    const text = String(body.text || "").trim();
    if (!number) return json({ ok: false, error: "Informe o WhatsApp de destino." });
    if (!text) return json({ ok: false, error: "A mensagem está vazia." });
    const buttons = parseButtons(body.buttons);

    const authOwn = await getAuthorizedUserAndCreds(authHeader, supabaseUrl, anonKey, serviceKey, "own");
    let token: string | null = null;
    let canal: "proprio" | "oficial" = "oficial";
    let baseUrl = "";

    if (authOwn.ok) {
      baseUrl = authOwn.baseUrl;
      const ownTok = await loadStoredInstanceToken(authOwn.supabaseAdmin, "own", authOwn.user.id);
      if (ownTok) {
        token = ownTok;
        canal = "proprio";
      }
      if (!token) {
        token = await loadStoredInstanceToken(authOwn.supabaseAdmin, "sistema", authOwn.user.id);
        canal = "oficial";
      }
    } else {
      const authSys = await getAuthorizedUserAndCreds(authHeader, supabaseUrl, anonKey, serviceKey, "sistema");
      if (!authSys.ok) {
        return json({ ok: false, error: JSON.parse(authOwn.body).error || "Sem permissão para enviar." });
      }
      baseUrl = authSys.baseUrl;
      token = await loadStoredInstanceToken(authSys.supabaseAdmin, "sistema", authSys.user.id);
    }

    if (!token) {
      return json({
        ok: false,
        error:
          "Nenhum WhatsApp uazapi conectado. Gere o QR Code no comunicador, escaneie e tente novamente.",
      });
    }

    const root = uazapiRoot(baseUrl);
    let send = await uazapiSendButtons(root, token, number, text, buttons);
    if (send.status < 200 || send.status >= 300) {
      send = await uazapiSendText(root, token, number, text);
    }

    if (send.status < 200 || send.status >= 300) {
      return json({
        ok: false,
        error: `UAZAPI recusou o envio (${send.status}).`,
        detail: send.text.slice(0, 500),
      });
    }

    const pdfB64 = body.pdf?.base64?.trim();
    const pdfName = body.pdf?.filename?.trim() || "confirmacao.pdf";
    if (pdfB64) {
      const doc = await uazapiSendDocument(root, token, number, pdfName, pdfB64);
      if (doc.status < 200 || doc.status >= 300) {
        return json({
          ok: true,
          canal,
          warning: `Mensagem enviada, mas o PDF falhou (${doc.status}).`,
        });
      }
    }

    return json({ ok: true, canal });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg });
  }
});
