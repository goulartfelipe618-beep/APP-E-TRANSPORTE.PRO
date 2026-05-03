import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "motorista-frota-docs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const token = (url.searchParams.get("token") || "").trim();
  if (!token || !UUID_RE.test(token)) {
    return new Response(JSON.stringify({ error: "Token inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
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

    const ownerId = sm.user_id as string;

    const [{ data: cfg }, { data: cab }] = await Promise.all([
      supabaseAdmin
        .from("configuracoes")
        .select("nome_empresa, nome_completo, nome_projeto, cnpj, logo_url, cidade, estado")
        .eq("user_id", ownerId)
        .maybeSingle(),
      supabaseAdmin.from("cabecalho_contratual").select("possui_cnpj, razao_social").eq("user_id", ownerId).maybeSingle(),
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
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(perfilPath, 120);
      if (!signErr && signed?.signedUrl) fotoMotoristaUrl = signed.signedUrl;
    }

    const body = {
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
