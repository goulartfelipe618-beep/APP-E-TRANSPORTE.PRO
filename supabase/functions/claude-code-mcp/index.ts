import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, accept, mcp-protocol-version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

const STATUS_OK = new Set(["pendente", "confirmada", "em_andamento", "concluida", "cancelada"]);

type JsonRpc = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

function rpcResult(id: JsonRpc["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(id: JsonRpc["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bearer(req: Request): string {
  const header = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)/i);
  return match?.[1]?.trim() ?? "";
}

function normalizeStatus(raw: unknown): string | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
  if (s === "confirmado" || s === "confirmada") return "confirmada";
  if (s === "concluido" || s === "concluida") return "concluida";
  if (s === "cancelado" || s === "cancelada") return "cancelada";
  if (s === "em_andamento" || s === "emandamento" || s === "andamento") return "em_andamento";
  if (s === "pendente") return "pendente";
  return STATUS_OK.has(s) ? s : null;
}

function safeSearch(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[%_,.*()\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function limitOf(raw: unknown, fallback = 30): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(50, Math.max(1, Math.trunc(n)));
}

function toolText(data: unknown, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    isError,
  };
}

const TOOLS = [
  {
    name: "conta",
    description: "Quem é o operador desta chave: e-mail, papel e plano. Só a conta dele.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "listar_reservas",
    description:
      "Reservas de transfer desta conta. Filtros opcionais: de, ate (YYYY-MM-DD na data de ida), status, busca (nome ou número), limite (máx. 50).",
    inputSchema: {
      type: "object",
      properties: {
        de: { type: "string" },
        ate: { type: "string" },
        status: { type: "string" },
        busca: { type: "string" },
        limite: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "obter_reserva",
    description: "Uma reserva desta conta, por id (uuid) ou numero.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, numero: { type: "number" } },
      additionalProperties: false,
    },
  },
  {
    name: "atualizar_status_reserva",
    description:
      "Muda só o status de uma reserva desta conta. Status: pendente, confirmada, em_andamento, concluida, cancelada.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        numero: { type: "number" },
        status: { type: "string" },
      },
      required: ["status"],
      additionalProperties: false,
    },
  },
  {
    name: "listar_veiculos",
    description: "Veículos da frota desta conta (sem chassi nem renavam).",
    inputSchema: {
      type: "object",
      properties: { limite: { type: "number" } },
      additionalProperties: false,
    },
  },
  {
    name: "listar_motoristas",
    description: "Motoristas cadastrados nesta conta (sem CPF, sem link do portal, sem documentos).",
    inputSchema: {
      type: "object",
      properties: { limite: { type: "number" }, status: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "listar_clientes",
    description: "Clientes desta conta (nome, telefone e e-mail). Sem CPF/CNPJ e sem documentos.",
    inputSchema: {
      type: "object",
      properties: { limite: { type: "number" }, busca: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "resumo_financeiro",
    description: "Totais financeiros dos últimos 90 dias desta conta, agrupados por tipo e estado de pagamento.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

const RESERVA_COLS =
  "id, numero_reserva, status, nome_completo, telefone, email, tipo_viagem, ida_embarque, ida_desembarque, ida_data, ida_hora, ida_passageiros, volta_embarque, volta_desembarque, volta_data, volta_hora, por_hora_data, por_hora_hora, valor_total, metodo_pagamento, motorista_id, veiculo_id, categoria_veiculo, perna_viagem, observacoes, created_at";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json(rpcError(null, -32600, "Use POST com JSON-RPC."), 405);
  }

  const token = bearer(req);
  if (!token.startsWith("etp_cc_")) {
    return json(rpcError(null, -32001, "Chave do Claude Code em falta ou inválida."), 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const tokenHash = await sha256Hex(token);
  const { data: keyRow, error: keyErr } = await supabase
    .from("claude_code_tokens")
    .select("id, user_id, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (keyErr || !keyRow || keyRow.revoked_at) {
    return json(rpcError(null, -32001, "Chave revogada ou desconhecida."), 401);
  }

  const userId = keyRow.user_id as string;
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin_transfer", "admin_master"])
    .limit(1)
    .maybeSingle();

  if (!roleRow) {
    return json(rpcError(null, -32001, "Esta conta já não pode usar o Claude Code."), 403);
  }

  await supabase.from("claude_code_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);

  let message: JsonRpc;
  try {
    message = await req.json();
  } catch {
    return json(rpcError(null, -32700, "JSON inválido."), 400);
  }

  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return json(rpcError(null, -32600, "Envie um único pedido JSON-RPC."), 400);
  }

  const method = String(message.method ?? "");
  const params = (message.params ?? {}) as Record<string, unknown>;

  if (!message.id && method.startsWith("notifications/")) {
    return new Response(null, { status: 202, headers: corsHeaders });
  }

  try {
    if (method === "initialize") {
      const requested = String((params as { protocolVersion?: string }).protocolVersion ?? "");
      const protocolVersion = ["2025-06-18", "2025-03-26", "2024-11-05"].includes(requested)
        ? requested
        : "2025-03-26";
      return json(
        rpcResult(message.id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "e-transporte", version: "1.0.0" },
          instructions:
            "Operação da conta que criou esta chave no painel E-TRANSPORTE (Motorista Executivo). " +
            "Só existem os dados dessa conta. Não peças a chave de novo. " +
            "Não inventes reservas, valores ou clientes. Para mudar uma viagem, usa apenas atualizar_status_reserva.",
        }),
      );
    }

    if (method === "ping") return json(rpcResult(message.id, {}));
    if (method === "tools/list") return json(rpcResult(message.id, { tools: TOOLS }));
    if (method === "resources/list") return json(rpcResult(message.id, { resources: [] }));
    if (method === "prompts/list") return json(rpcResult(message.id, { prompts: [] }));

    if (method === "tools/call") {
      const name = String(params.name ?? "");
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      const result = await callTool(supabase, userId, name, args);
      return json(rpcResult(message.id, result));
    }

    return json(rpcError(message.id, -32601, `Método não suportado: ${method}`));
  } catch (err) {
    const text = err instanceof Error ? err.message : "Falha interna";
    return json(rpcError(message.id, -32603, text), 500);
  }
});

async function callTool(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  name: string,
  args: Record<string, unknown>,
) {
  if (name === "conta") {
    const { data: userData, error } = await supabase.auth.admin.getUserById(userId);
    if (error) return toolText({ erro: error.message }, true);
    const { data: plan } = await supabase.from("user_plans").select("plano").eq("user_id", userId).maybeSingle();
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    return toolText({
      user_id: userId,
      email: userData.user?.email ?? null,
      plano: plan?.plano ?? null,
      papeis: (roles ?? []).map((r) => r.role),
    });
  }

  if (name === "listar_reservas") {
    let q = supabase
      .from("reservas_transfer")
      .select(RESERVA_COLS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limitOf(args.limite));
    if (typeof args.de === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.de)) q = q.gte("ida_data", args.de);
    if (typeof args.ate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.ate)) q = q.lte("ida_data", args.ate);
    const status = normalizeStatus(args.status);
    if (args.status != null && args.status !== "" && !status) {
      return toolText({ erro: "Status inválido." }, true);
    }
    if (status) q = q.eq("status", status);
    const busca = safeSearch(args.busca);
    if (/^\d+$/.test(busca)) q = q.eq("numero_reserva", Number(busca));
    else if (busca) q = q.ilike("nome_completo", `%${busca}%`);
    const { data, error } = await q;
    if (error) return toolText({ erro: error.message }, true);
    return toolText({ total: data?.length ?? 0, reservas: data ?? [] });
  }

  if (name === "obter_reserva") {
    let q = supabase.from("reservas_transfer").select(RESERVA_COLS).eq("user_id", userId);
    if (typeof args.id === "string" && args.id) q = q.eq("id", args.id);
    else if (args.numero != null && Number.isFinite(Number(args.numero))) q = q.eq("numero_reserva", Number(args.numero));
    else return toolText({ erro: "Informe id ou numero." }, true);
    const { data, error } = await q.maybeSingle();
    if (error) return toolText({ erro: error.message }, true);
    if (!data) return toolText({ erro: "Reserva não encontrada nesta conta." }, true);
    return toolText(data);
  }

  if (name === "atualizar_status_reserva") {
    const status = normalizeStatus(args.status);
    if (!status) return toolText({ erro: "Status inválido." }, true);
    let q = supabase.from("reservas_transfer").update({ status, updated_at: new Date().toISOString() }).eq("user_id", userId);
    if (typeof args.id === "string" && args.id) q = q.eq("id", args.id);
    else if (args.numero != null && Number.isFinite(Number(args.numero))) q = q.eq("numero_reserva", Number(args.numero));
    else return toolText({ erro: "Informe id ou numero." }, true);
    const { data, error } = await q.select("id, numero_reserva, status, nome_completo, ida_data").maybeSingle();
    if (error) return toolText({ erro: error.message }, true);
    if (!data) return toolText({ erro: "Reserva não encontrada nesta conta." }, true);
    return toolText(data);
  }

  if (name === "listar_veiculos") {
    const { data, error } = await supabase
      .from("veiculos_frota")
      .select("id, tipo_veiculo, marca, modelo, ano, cor, placa, status, valor_km, valor_hora, tarifa_base, valor_minimo_corrida")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limitOf(args.limite, 50));
    if (error) return toolText({ erro: error.message }, true);
    return toolText({ total: data?.length ?? 0, veiculos: data ?? [] });
  }

  if (name === "listar_motoristas") {
    let q = supabase
      .from("solicitacoes_motoristas")
      .select("id, nome, telefone, email, cidade, estado, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limitOf(args.limite, 50));
    if (typeof args.status === "string" && args.status.trim()) q = q.eq("status", args.status.trim().slice(0, 40));
    const { data, error } = await q;
    if (error) return toolText({ erro: error.message }, true);
    return toolText({ total: data?.length ?? 0, motoristas: data ?? [] });
  }

  if (name === "listar_clientes") {
    let q = supabase
      .from("cadastro_clientes")
      .select("id, tipo, nome_exibicao, email, telefone_1, telefone_2, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limitOf(args.limite));
    const busca = safeSearch(args.busca);
    if (busca) q = q.ilike("nome_exibicao", `%${busca}%`);
    const { data, error } = await q;
    if (error) return toolText({ erro: error.message }, true);
    return toolText({ total: data?.length ?? 0, clientes: data ?? [] });
  }

  if (name === "resumo_financeiro") {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 90);
    const sinceIso = since.toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("financial_transactions")
      .select("kind, payment_status, amount, currency")
      .eq("user_id", userId)
      .gte("occurred_on", sinceIso)
      .limit(2000);
    if (error) return toolText({ erro: error.message }, true);
    const grupos = new Map<string, { kind: string; payment_status: string; moeda: string; quantidade: number; total: number }>();
    for (const row of data ?? []) {
      const key = `${row.kind}|${row.payment_status}|${row.currency ?? "BRL"}`;
      const cur = grupos.get(key) ?? {
        kind: row.kind,
        payment_status: row.payment_status,
        moeda: row.currency ?? "BRL",
        quantidade: 0,
        total: 0,
      };
      cur.quantidade += 1;
      cur.total += Number(row.amount) || 0;
      grupos.set(key, cur);
    }
    return toolText({
      periodo_dias: 90,
      desde: sinceIso,
      grupos: [...grupos.values()].map((g) => ({ ...g, total: Math.round(g.total * 100) / 100 })),
    });
  }

  return toolText({ erro: `Ferramenta desconhecida: ${name}` }, true);
}
