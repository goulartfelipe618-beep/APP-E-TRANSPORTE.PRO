import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveMotoristaJwtSecret } from "../_shared/motoristaJwtSecret.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "motorista-frota-docs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function decodeB64url(str: string): string {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  return atob(s);
}

async function hmacSha256B64Url(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const bin = String.fromCharCode(...new Uint8Array(sig));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlFromString(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signJwtHS256(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const h = b64urlFromString(JSON.stringify(header));
  const p = b64urlFromString(JSON.stringify(payload));
  const sig = await hmacSha256B64Url(secret, `${h}.${p}`);
  return `${h}.${p}.${sig}`;
}

type VerifiedClaims = {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  /** 1 = uso único + gate na linha (PDF antigo); 2 = sessão reutilizável (QR estável na ficha). */
  version: 1 | 2;
  qrt?: string;
};

async function verifyJwtHS256(token: string, secret: string): Promise<VerifiedClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  if (!h || !p || !s) return null;
  const expected = await hmacSha256B64Url(secret, `${h}.${p}`);
  if (expected.length !== s.length) return null;
  let ok = true;
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== s[i]) ok = false;
  }
  if (!ok) return null;
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(decodeB64url(p));
  } catch {
    return null;
  }
  const sub = String(payload.sub || "").trim();
  const jti = String(payload.jti || "").trim();
  const iat = Number(payload.iat);
  const exp = Number(payload.exp);
  if (!UUID_RE.test(sub) || !jti || !Number.isFinite(iat) || !Number.isFinite(exp)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (exp < now || iat > now + 120) return null;
  const vNum = Number(payload.v);
  const version: 1 | 2 = vNum === 2 ? 2 : 1;
  if (version === 2) {
    const qrt = String(payload.qrt || "").trim();
    if (!UUID_RE.test(qrt)) return null;
    return { sub, jti, iat, exp, version, qrt };
  }
  return { sub, jti, iat, exp, version: 1 };
}

function maskCnpj(digits: string): string | null {
  const d = digits.replace(/\D/g, "");
  if (d.length < 14) return null;
  return `**.***.***/${d.slice(8, 12)}-${d.slice(12)}`;
}

function pickStr(dw: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = dw[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function parseWebhook(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

type SmRow = {
  id: string;
  nome: string | null;
  user_id: string;
  status: string | null;
  dados_webhook: unknown;
  motorista_verificacao_qr_token?: string | null;
  motorista_verificacao_gate?: unknown;
};

async function buildVerificationJson(
  admin: SupabaseClient,
  sm: SmRow,
): Promise<Record<string, unknown>> {
  const ownerId = sm.user_id as string;

  const [{ data: cfg }, { data: cab }] = await Promise.all([
    admin
      .from("configuracoes")
      .select("nome_empresa, nome_completo, nome_projeto, cnpj, logo_url, cidade, estado")
      .eq("user_id", ownerId)
      .maybeSingle(),
    admin.from("cabecalho_contratual").select("possui_cnpj, razao_social").eq("user_id", ownerId).maybeSingle(),
  ]);

  const possuiCnpj = (cab?.possui_cnpj || "").toLowerCase() === "sim";
  const cnpjDigits = (cfg?.cnpj || "").replace(/\D/g, "");
  const temCnpjValido = possuiCnpj && cnpjDigits.length >= 14;

  const nomeEmpresaCfg = (cfg?.nome_empresa || "").trim();
  const nomeCompletoCfg = (cfg?.nome_completo || "").trim();
  const nomeProjetoCfg = (cfg?.nome_projeto || "").trim();
  const razao = (cab?.razao_social || "").trim();

  let empresaNome: string;
  let empresaRegime: "pj" | "pf";
  let cnpjMascarado: string | null = null;

  if (temCnpjValido) {
    empresaRegime = "pj";
    cnpjMascarado = maskCnpj(cnpjDigits);
    empresaNome = nomeEmpresaCfg || razao || nomeProjetoCfg || "Empresa credenciada";
  } else {
    empresaRegime = "pf";
    empresaNome = nomeEmpresaCfg || nomeCompletoCfg || nomeProjetoCfg || "Prestador credenciado";
  }

  const regiao = [cfg?.cidade, cfg?.estado].filter(Boolean).join(" / ").trim() || null;

  const dw = parseWebhook(sm.dados_webhook);
  const perfilPath = pickStr(dw, "doc_perfil_path", "doc_foto_perfil_path");
  let fotoMotoristaUrl: string | null = null;
  if (perfilPath && !/^https?:\/\//i.test(perfilPath)) {
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(perfilPath, 120);
    if (!signErr && signed?.signedUrl) fotoMotoristaUrl = signed.signedUrl;
  }

  return {
    ok: true as const,
    motorista_nome: String(sm.nome || "").trim() || "Motorista",
    empresa_nome: empresaNome,
    empresa_regime: empresaRegime,
    cnpj_mascarado: cnpjMascarado,
    regiao,
    logo_url: (cfg?.logo_url || "").trim() || null,
    foto_motorista_url: fotoMotoristaUrl,
    ref_publica: `AUT-${String(sm.id).replace(/-/g, "").slice(0, 10).toUpperCase()}`,
  };
}

function gateMatches(
  gate: unknown,
  jti: string,
  iat: number,
): boolean {
  if (!gate || typeof gate !== "object" || Array.isArray(gate)) return false;
  const o = gate as Record<string, unknown>;
  const gj = String(o.jti || "").trim();
  const gi = Number(o.iat);
  return gj === jti && gi === iat;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const g = (url.searchParams.get("g") || "").trim();
  const token = (url.searchParams.get("token") || "").trim();

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const session = (url.searchParams.get("session") || "").trim();
    const qrtBootstrap = (url.searchParams.get("qrt") || "").trim();
    if (session === "1" && qrtBootstrap && UUID_RE.test(qrtBootstrap)) {
      const secretSes = await resolveMotoristaJwtSecret();
      if (secretSes.length < 16) {
        return new Response(JSON.stringify({ error: "Serviço de verificação indisponível." }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }
      const { data: smSes, error: sesErr } = await supabaseAdmin
        .from("solicitacoes_motoristas")
        .select("id, motorista_verificacao_qr_token, status")
        .eq("motorista_verificacao_qr_token", qrtBootstrap)
        .maybeSingle();
      const stOk = String(smSes?.status || "").toLowerCase().trim();
      if (sesErr || !smSes || (stOk && stOk !== "cadastrado")) {
        return new Response(JSON.stringify({ error: "Selo não encontrado." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }
      const jti = crypto.randomUUID();
      const iat = Math.floor(Date.now() / 1000);
      const exp = iat + 2 * 3600;
      const jwt = await signJwtHS256({
        v: 2,
        sub: smSes.id as string,
        qrt: qrtBootstrap,
        jti,
        iat,
        exp,
      }, secretSes);

      return new Response(JSON.stringify({ jwt, exp }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    if (g) {
      const secret = await resolveMotoristaJwtSecret();
      if (secret.length < 16) {
        return new Response(JSON.stringify({ error: "Serviço de verificação indisponível." }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }

      const claims = await verifyJwtHS256(g, secret);
      if (!claims) {
        return new Response(JSON.stringify({ error: "Link inválido ou expirado. Exporte uma ficha nova no painel." }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }

      /** JWT v2 — sessão a partir do QR estável na ficha PDF (vários scans / recargas válidos até exp). */
      if (claims.version === 2 && claims.qrt) {
        const { data: sm2, error: sm2Err } = await supabaseAdmin
          .from("solicitacoes_motoristas")
          .select("id, nome, user_id, status, dados_webhook, motorista_verificacao_qr_token")
          .eq("id", claims.sub)
          .maybeSingle();
        const tokDb = String(sm2?.motorista_verificacao_qr_token ?? "").trim();
        if (sm2Err || !sm2 || tokDb !== claims.qrt) {
          return new Response(JSON.stringify({ error: "Link inválido ou expirado. Peça ao operador a ficha atualizada." }), {
            status: 410,
            headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }
        const body = await buildVerificationJson(supabaseAdmin, sm2 as SmRow);
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Cache-Control": "no-store, max-age=0",
          },
        });
      }

      const { data: sm, error: smErr } = await supabaseAdmin
        .from("solicitacoes_motoristas")
        .select("id, nome, user_id, status, dados_webhook, motorista_verificacao_gate")
        .eq("id", claims.sub)
        .maybeSingle();

      if (smErr || !sm) {
        return new Response(JSON.stringify({ error: "Motorista não encontrado." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }

      if (!gateMatches(sm.motorista_verificacao_gate, claims.jti, claims.iat)) {
        return new Response(
          JSON.stringify({
            error:
              "Este link já foi utilizado ou foi substituído por uma ficha mais recente. Peça ao operador o PDF atualizado.",
          }),
          {
            status: 410,
            headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
          },
        );
      }

      const body = await buildVerificationJson(supabaseAdmin, sm as SmRow);

      await supabaseAdmin
        .from("solicitacoes_motoristas")
        .update({ motorista_verificacao_gate: null })
        .eq("id", claims.sub);

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    if (!token || !UUID_RE.test(token)) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    const { data: sm, error: smErr } = await supabaseAdmin
      .from("solicitacoes_motoristas")
      .select("id, nome, user_id, status, dados_webhook, motorista_verificacao_qr_token")
      .eq("motorista_verificacao_qr_token", token)
      .maybeSingle();

    if (smErr || !sm) {
      return new Response(JSON.stringify({ error: "Verificação indisponível ou motorista não encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    const body = await buildVerificationJson(supabaseAdmin, sm as SmRow);

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
});
