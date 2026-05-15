/**
 * Proxy controlado para a Evolution API: credenciais oficiais só no servidor;
 * cada sessão só pode operar a instância etp-u-* derivada do auth.uid().
 * Bloqueia /chat, /message e qualquer path fora da allowlist de /instance/*.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertHttpsBaseUrl } from "../_shared/ssrfSafeHttps.ts";

const PROXY_JSON_HEADERS: Record<string, string> = {
  ...corsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "private, no-store, max-age=0",
  "Pragma": "no-cache",
  "Vary": "Authorization",
};

const MAX_UPSTREAM_TEXT = 400_000;

function instanceNameForUser(userId: string): string {
  return `etp-u-${userId.replace(/-/g, "").slice(0, 16)}`;
}

function decodePathInstanceSegment(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

function extractInstanceNameFromItem(item: unknown): string | null {
  const wrap =
    item && typeof item === "object" && "instance" in (item as object)
      ? (item as { instance?: unknown }).instance
      : item;
  if (!wrap || typeof wrap !== "object") return null;
  const n = (wrap as { instanceName?: unknown }).instanceName;
  return typeof n === "string" && n ? n : null;
}

/** Mantém só o item cuja instância corresponde ao utilizador (nunca repassa lista global). */
function filterFetchInstancesBody(bodyText: string, allowedName: string): string {
  try {
    const data = JSON.parse(bodyText) as unknown;
    const arr = Array.isArray(data) ? data : [data];
    const kept: unknown[] = [];
    for (const item of arr) {
      if (extractInstanceNameFromItem(item) === allowedName) {
        kept.push(item);
      }
    }
    if (kept.length === 0) {
      return "[]";
    }
    if (kept.length === 1 && !Array.isArray(data)) {
      return JSON.stringify(kept[0]);
    }
    return JSON.stringify(kept);
  } catch {
    return "[]";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: PROXY_JSON_HEADERS,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: PROXY_JSON_HEADERS,
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
        headers: PROXY_JSON_HEADERS,
      });
    }

    const ownedInstance = instanceNameForUser(user.id);

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const { data: sistemaRow, error: sysErr } = await supabaseAdmin
      .from("comunicadores_evolution")
      .select("id")
      .eq("escopo", "sistema")
      .maybeSingle();

    if (sysErr || !sistemaRow?.id) {
      return new Response(JSON.stringify({ error: "Comunicador oficial não configurado." }), {
        status: 500,
        headers: PROXY_JSON_HEADERS,
      });
    }

    const { data: credsRow, error: credErr } = await supabaseAdmin
      .from("comunicador_evolution_credenciais")
      .select("api_url, api_key")
      .eq("comunicador_id", sistemaRow.id)
      .maybeSingle();

    if (credErr || !credsRow?.api_url?.trim() || !credsRow?.api_key?.trim()) {
      return new Response(JSON.stringify({ error: "Credenciais Evolution não configuradas no servidor." }), {
        status: 400,
        headers: PROXY_JSON_HEADERS,
      });
    }

    const baseUrl = assertHttpsBaseUrl(credsRow.api_url.trim());
    const apiKey = credsRow.api_key.trim();

    const body = await req.json() as {
      path?: string;
      method?: string;
      jsonBody?: unknown;
      /** Legado (ignorado): credenciais passam a ser só do servidor. */
      baseUrl?: string;
      apiKey?: string;
    };

    const pathRaw = String(body.path || "").trim();
    const path = pathRaw.startsWith("/") ? pathRaw : `/${pathRaw}`;
    const method = (body.method || "GET").toUpperCase();

    if (path === "/" || !path) {
      return new Response(JSON.stringify({ error: "path é obrigatório" }), {
        status: 400,
        headers: PROXY_JSON_HEADERS,
      });
    }

    const forbiddenPrefix = ["/chat/", "/message/", "/group/", "/webhook/", "/settings/", "/integrations/"];
    const lower = path.toLowerCase();
    if (forbiddenPrefix.some((p) => lower.startsWith(p))) {
      return new Response(JSON.stringify({ error: "Operação não permitida por este proxy." }), {
        status: 403,
        headers: PROXY_JSON_HEADERS,
      });
    }

    if (!lower.startsWith("/instance/")) {
      return new Response(JSON.stringify({ error: "Apenas endpoints /instance/* são permitidos." }), {
        status: 403,
        headers: PROXY_JSON_HEADERS,
      });
    }

    let upstreamPath = path;
    let jsonBody: unknown = body.jsonBody ?? undefined;

    const mConnect = /^\/instance\/connect\/([^/]+)$/.exec(path);
    const mConnState = /^\/instance\/connectionState\/([^/]+)$/.exec(path);
    const mFetch = path === "/instance/fetchInstances";
    const mCreate = path === "/instance/create";

    if (mConnect) {
      const seg = decodePathInstanceSegment(mConnect[1]!);
      if (seg !== ownedInstance) {
        return new Response(JSON.stringify({ error: "Instância não autorizada para esta sessão." }), {
          status: 403,
          headers: PROXY_JSON_HEADERS,
        });
      }
    } else if (mConnState) {
      const seg = decodePathInstanceSegment(mConnState[1]!);
      if (seg !== ownedInstance) {
        return new Response(JSON.stringify({ error: "Instância não autorizada para esta sessão." }), {
          status: 403,
          headers: PROXY_JSON_HEADERS,
        });
      }
    } else if (mFetch) {
      if (method !== "GET") {
        return new Response(JSON.stringify({ error: "fetchInstances apenas GET." }), {
          status: 405,
          headers: PROXY_JSON_HEADERS,
        });
      }
    } else if (mCreate) {
      if (method !== "POST") {
        return new Response(JSON.stringify({ error: "create apenas POST." }), {
          status: 405,
          headers: PROXY_JSON_HEADERS,
        });
      }
      const ob = jsonBody && typeof jsonBody === "object" ? { ...(jsonBody as Record<string, unknown>) } : {};
      ob.instanceName = ownedInstance;
      jsonBody = ob;
    } else {
      return new Response(
        JSON.stringify({ error: "Endpoint Evolution não autorizado através do proxy para esta conta." }),
        {
          status: 403,
          headers: PROXY_JSON_HEADERS,
        },
      );
    }

    const target = `${baseUrl.replace(/\/+$/, "")}${upstreamPath}`;

    const headers: Record<string, string> = {
      apikey: apiKey,
    };
    if (method === "POST" && jsonBody !== undefined && jsonBody !== null) {
      headers["Content-Type"] = "application/json";
    }

    const init: RequestInit = {
      method,
      headers,
    };
    if (method === "POST" && jsonBody !== undefined && jsonBody !== null) {
      init.body = JSON.stringify(jsonBody);
    }

    const evoRes = await fetch(target, init);
    let rawText = await evoRes.text();

    if (mFetch && evoRes.ok) {
      rawText = filterFetchInstancesBody(rawText, ownedInstance);
    }

    const bodyText =
      rawText.length > MAX_UPSTREAM_TEXT
        ? `${rawText.slice(0, MAX_UPSTREAM_TEXT)}\n…(truncado, ${rawText.length - MAX_UPSTREAM_TEXT} chars omitidos)`
        : rawText;

    return new Response(
      JSON.stringify({
        status: evoRes.status,
        bodyText,
      }),
      {
        status: 200,
        headers: PROXY_JSON_HEADERS,
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: PROXY_JSON_HEADERS,
    });
  }
});
