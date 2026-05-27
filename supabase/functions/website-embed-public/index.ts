import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const MAX_BODY_BYTES = 2_500_000;
const MAX_LOGO_BYTES = 4 * 1024 * 1024;
const ALLOWED_LOGO_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function sanitizeText(v: unknown, max = 5000): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function sanitizeBriefingPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const templateId = sanitizeText(o.template_id, 64);
  const templateName = sanitizeText(o.template, 200);
  const whatsapp = sanitizeText(o.whatsapp, 40);
  const company = sanitizeText(o.nome_empresa, 200);
  const email = sanitizeText(o.email, 200);

  if (!templateId || !templateName) return null;
  if (!whatsapp || !company || !email) return null;

  return {
    ...o,
    template_id: templateId,
    template: templateName,
    whatsapp,
    nome_empresa: company,
    email,
    origem: "wordpress_embed",
    sem_dominio: true,
    dominio: sanitizeText(o.dominio, 253) || null,
    possui_dominio: false,
  };
}

async function listTemplates(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin
    .from("templates_website")
    .select("id, nome, imagem_url, link_modelo, ordem")
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (error) {
    console.error("templates_website:", error.message);
    return json(500, { error: "Não foi possível carregar os templates." });
  }
  return json(200, { templates: data ?? [] });
}

async function submitBriefing(
  admin: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
) {
  const dados = sanitizeBriefingPayload(body.dados_solicitacao);
  if (!dados) {
    return json(400, { error: "Briefing inválido. Verifique template, empresa, WhatsApp e e-mail." });
  }

  let logoUrl: string | null = null;
  const logoB64 = typeof body.logo_base64 === "string" ? body.logo_base64.trim() : "";
  const logoMime = typeof body.logo_mime === "string" ? body.logo_mime.trim().toLowerCase() : "";

  if (logoB64) {
    if (!ALLOWED_LOGO_MIMES.has(logoMime)) {
      return json(400, { error: "Formato de logo não permitido." });
    }
    let bytes: Uint8Array;
    try {
      bytes = decodeBase64ToBytes(logoB64);
    } catch {
      return json(400, { error: "Logo inválida (base64)." });
    }
    if (bytes.byteLength > MAX_LOGO_BYTES) {
      return json(400, { error: "Logo excede o tamanho máximo (4 MB)." });
    }
    const ext =
      logoMime === "image/png" ? "png"
      : logoMime === "image/jpeg" ? "jpg"
      : logoMime === "image/webp" ? "webp"
      : logoMime === "image/gif" ? "gif"
      : "svg";
    const path = `embed/${crypto.randomUUID()}-logo.${ext}`;
    const { error: upErr } = await admin.storage.from("website-briefing").upload(path, bytes, {
      contentType: logoMime,
      upsert: false,
      cacheControl: "3600",
    });
    if (upErr) {
      console.error("logo upload:", upErr.message);
      return json(500, { error: "Não foi possível enviar a logo." });
    }
    const { data: pub } = admin.storage.from("website-briefing").getPublicUrl(path);
    logoUrl = pub.publicUrl;
    dados.logo_url = logoUrl;
  }

  const referrer = sanitizeText(body.referrer, 500);
  if (referrer) dados.embed_referrer = referrer;

  const { data: inserted, error } = await admin
    .from("solicitacoes_servicos")
    .insert({
      user_id: null,
      tipo_servico: "website",
      status: "pendente",
      dados_solicitacao: dados,
    })
    .select("id")
    .single();

  if (error) {
    console.error("insert solicitacao:", error.message);
    return json(500, { error: "Não foi possível registrar o briefing." });
  }

  return json(200, { ok: true, id: inserted.id });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "Servidor não configurado." });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (req.method === "GET") {
    return listTemplates(admin);
  }

  if (req.method !== "POST") {
    return json(405, { error: "Método não permitido." });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json(413, { error: "Payload muito grande." });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json(400, { error: "JSON inválido." });
  }

  return submitBriefing(admin, body);
});
