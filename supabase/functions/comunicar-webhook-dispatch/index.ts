import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Mesmo conjunto que `@supabase/supabase-js/cors` (inclui Allow-Methods).
 * Sem `Access-Control-Allow-Methods`, o preflight do POST falha no browser.
 */
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
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

/**
 * IMPORTANTE: para o `supabase-js` no front conseguir ler o body de erro,
 * a Edge Function deve responder 200 sempre que conseguir processar a
 * requisição (mesmo que o webhook destino devolva 4xx/5xx). Caso contrário
 * o `supabase.functions.invoke` apresenta apenas
 * "Edge Function returned a non-2xx status code" sem o motivo real.
 */
function jsonOk<T>(body: T, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

/** Body do n8n truncado para não estourar a resposta da função. */
function truncate(s: string, max = 1500): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…(truncado, ${s.length - max} chars omitidos)`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonOk({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonOk({ ok: false, error: "Não autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return jsonOk({ ok: false, error: "Sessão inválida" }, 401);
    }

    const body = (await req.json()) as { tipo?: string; payload?: unknown };
    const tipo = String(body.tipo || "").trim();
    if (!TIPOS_VALIDOS.has(tipo)) {
      return jsonOk({ ok: false, error: "tipo de webhook inválido" }, 400);
    }

    const col = COL[tipo];
    if (!col) {
      return jsonOk({ ok: false, error: "tipo não mapeado" }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { data: row, error: rowErr } = await supabaseAdmin
      .from("sistema_webhooks_comunicacao")
      .select("*")
      .eq("id", ROW_ID)
      .maybeSingle();

    if (rowErr) {
      console.error("[comunicar-webhook] read error", rowErr);
      // 200 para o cliente conseguir ler o body via supabase-js.
      return jsonOk({ ok: false, error: "Erro ao ler configuração de webhooks" });
    }

    if (!row) {
      return jsonOk({
        ok: false,
        error:
          "Configuração de webhooks não encontrada. Aplique a migração " +
          "20260410120000_sistema_webhooks_comunicacao.sql.",
      });
    }

    const rawUrl = (row as Record<string, unknown>)[col] as string | null | undefined;
    if (!rawUrl?.trim()) {
      return jsonOk({
        ok: false,
        error:
          "Webhook não configurado para este tipo. O administrador master deve preencher em Admin → Comunicador.",
      });
    }

    let targetUrl: string;
    try {
      targetUrl = assertSafeHttps(rawUrl);
    } catch (e) {
      return jsonOk({
        ok: false,
        error: `URL do webhook inválida: ${e instanceof Error ? e.message : String(e)}`,
      });
    }

    // Timeout para evitar Edge Function "stuck" se o n8n estiver pendurado.
    const ctrl = new AbortController();
    const timeoutMs = 15_000;
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    let n8nRes: Response;
    try {
      n8nRes = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Header opcional para o admin distinguir origens no n8n.
          "X-E-Transporte-Tipo": tipo,
        },
        body: JSON.stringify(body.payload ?? {}),
        signal: ctrl.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timer);
      const msg =
        fetchErr instanceof Error
          ? fetchErr.name === "AbortError"
            ? `O webhook n8n não respondeu em ${Math.round(timeoutMs / 1000)}s.`
            : fetchErr.message
          : String(fetchErr);
      console.error("[comunicar-webhook] fetch n8n falhou", msg);
      return jsonOk({
        ok: false,
        status: 0,
        error: `Falha ao chamar o webhook n8n: ${msg}`,
      });
    }
    clearTimeout(timer);

    const status = n8nRes.status;
    let respText = "";
    try {
      respText = await n8nRes.text();
    } catch { /* noop */ }

    const ok = n8nRes.ok;

    // Mensagem amigável para os erros mais comuns do n8n.
    let friendly: string | undefined;
    if (!ok) {
      if (status === 404) {
        friendly =
          "O n8n devolveu 404. O workflow pode não estar Active (no n8n: clique no toggle " +
          "'Active') ou a URL é a de TEST e não a de PRODUCTION. Use a URL Production do nó Webhook.";
      } else if (status === 401 || status === 403) {
        friendly =
          "O n8n recusou a chamada (auth). Verifique se o nó Webhook não exige Header Auth " +
          "que o sistema não envia.";
      } else if (status >= 500) {
        friendly = `O n8n devolveu ${status}. Verifique a execução do workflow no painel do n8n.`;
      }
    }

    return jsonOk({
      ok,
      status,
      error: ok ? undefined : friendly || `Webhook destino retornou status ${status}.`,
      n8n_response: truncate(respText),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[comunicar-webhook] exception", msg);
    return jsonOk({ ok: false, error: msg });
  }
});
