/**
 * Backup diário por empresa para o R2.
 * Nunca apaga linhas no Postgres nem pastas de outros dias/utilizadores.
 * Prefixo: backups/{empresa}__{userId8}/{dd.mm.yy}/...
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { r2Client, r2Put } from "./r2.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-r2-backup-cron-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function dateFolderSp(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).formatToParts(d);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${pick("day")}.${pick("month")}.${pick("year")}`;
}

function slugEmpresa(nome: string, userId: string): string {
  const base =
    nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "empresa";
  return `${base}__${userId.slice(0, 8)}`;
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Record<string, unknown>[]): Uint8Array {
  const encoder = new TextEncoder();
  if (!rows.length) return encoder.encode("\uFEFF");
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  const lines = [
    keys.join(","),
    ...rows.map((r) => keys.map((k) => csvEscape(r[k])).join(",")),
  ];
  return encoder.encode(`\uFEFF${lines.join("\r\n")}`);
}

async function fetchByUser(
  admin: SupabaseClient,
  table: string,
  userId: string,
  filter?: { eq?: { col: string; val: string }; neq?: { col: string; val: string } },
): Promise<Record<string, unknown>[]> {
  const pageSize = 1000;
  const out: Record<string, unknown>[] = [];
  let from = 0;
  for (;;) {
    let q = admin.from(table).select("*").eq("user_id", userId);
    if (filter?.eq) q = q.eq(filter.eq.col, filter.eq.val);
    if (filter?.neq) q = q.neq(filter.neq.col, filter.neq.val);
    q = q.order("created_at", { ascending: true });
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const chunk = (data ?? []) as Record<string, unknown>[];
    out.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
    if (from > 200_000) break;
  }
  return out;
}

function supabaseProjectHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

async function downloadOwnMedia(
  admin: SupabaseClient,
  supabaseUrl: string,
  rawUrl: string,
  userId: string,
): Promise<{ bytes: Uint8Array; contentType: string; ext: string } | null> {
  const t = rawUrl.trim();
  if (!t) return null;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return null;
  }
  const host = supabaseProjectHost(supabaseUrl);
  if (!host || u.hostname.toLowerCase() !== host) return null;
  const r2Marker = "/functions/v1/r2-media/espelho/";
  const r2i = u.pathname.indexOf(r2Marker);
  if (r2i >= 0) {
    const rest = decodeURIComponent(u.pathname.slice(r2i + r2Marker.length));
    const slash = rest.indexOf("/");
    if (slash < 0) return null;
    const bucket = rest.slice(0, slash);
    const path = rest.slice(slash + 1);
    if (!path.startsWith(`${userId}/`)) return null;
    const { data, error } = await admin.storage.from(bucket).download(path);
    if (error || !data) return null;
    const buf = new Uint8Array(await data.arrayBuffer());
    const ext = (path.split(".").pop() || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
    return { bytes: buf, contentType: data.type || "application/octet-stream", ext };
  }
  const marker = "/storage/v1/object/";
  const i = u.pathname.indexOf(marker);
  if (i < 0) return null;
  let rest = u.pathname.slice(i + marker.length);
  rest = rest.replace(/^(public|sign|authenticated)\//, "");
  const slash = rest.indexOf("/");
  if (slash < 0) return null;
  const bucket = rest.slice(0, slash);
  const path = decodeURIComponent(rest.slice(slash + 1));
  if (!path.startsWith(`${userId}/`)) return null;
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) return null;
  const buf = new Uint8Array(await data.arrayBuffer());
  const ext = (path.split(".").pop() || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
  return { bytes: buf, contentType: data.type || "application/octet-stream", ext };
}

async function runForUser(
  admin: SupabaseClient,
  userId: string,
  supabaseUrl: string,
): Promise<{ ok: boolean; stats: Record<string, unknown>; error?: string; prefix: string }> {
  const { data: cfg } = await admin
    .from("configuracoes")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: cab } = await admin
    .from("cabecalho_contratual")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const cfgRow = (cfg ?? {}) as Record<string, unknown>;
  const cabRow = (cab ?? {}) as Record<string, unknown>;
  const empresaNome = String(
    cfgRow.nome_empresa || cfgRow.nome_projeto || cabRow.razao_social || cabRow.nome || "empresa",
  );
  const dateFolder = dateFolderSp();
  const prefix = `backups/${slugEmpresa(empresaNome, userId)}/${dateFolder}`;
  const r2 = r2Client();
  const stats: Record<string, unknown> = { prefix, date: dateFolder, files: {} };
  const files = stats.files as Record<string, number>;

  const putCsv = async (rel: string, rows: Record<string, unknown>[]) => {
    const key = `${prefix}/${rel}`;
    await r2Put(r2, key, toCsv(rows), "text/csv; charset=utf-8");
    files[rel] = rows.length;
  };

  const { data: existing } = await admin
    .from("r2_auto_backup_settings")
    .select("enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    await admin
      .from("r2_auto_backup_settings")
      .update({
        last_status: "running",
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else {
    await admin.from("r2_auto_backup_settings").insert({
      user_id: userId,
      enabled: true,
      last_status: "running",
      last_error: null,
    });
  }

  const transferSol = await fetchByUser(admin, "solicitacoes_transfer", userId);
  const transferRes = await fetchByUser(admin, "reservas_transfer", userId);
  await putCsv("TRANSFER/SOLICITACOES.csv", transferSol);
  await putCsv("TRANSFER/RESERVAS.csv", transferRes);

  const gruposSol = await fetchByUser(admin, "solicitacoes_grupos", userId);
  const gruposRes = await fetchByUser(admin, "reservas_grupos", userId);
  await putCsv("GRUPOS/SOLICITACOES.csv", gruposSol);
  await putCsv("GRUPOS/RESERVAS.csv", gruposRes);

  const motCad = await fetchByUser(admin, "solicitacoes_motoristas", userId, {
    eq: { col: "status", val: "cadastrado" },
  });
  const motSol = await fetchByUser(admin, "solicitacoes_motoristas", userId, {
    neq: { col: "status", val: "cadastrado" },
  });
  await putCsv("MOTORISTAS/CADASTROS.csv", motCad);
  await putCsv("MOTORISTAS/SOLICITACOES.csv", motSol);

  const clientes = await fetchByUser(admin, "cadastro_clientes", userId);
  await putCsv("CLIENTES/CLIENTES.csv", clientes);

  const veiculos = await fetchByUser(admin, "veiculos_frota", userId);
  await putCsv("VEICULOS/VEICULOS.csv", veiculos);

  const perfil = { ...cfgRow };
  const projeto = {
    nome_projeto: cfgRow.nome_projeto ?? "",
    fonte_global: cfgRow.fonte_global ?? "",
    logo_url: cfgRow.logo_url ?? "",
  };
  await putCsv("CONFIGURACOES/MEU_PERFIL.csv", Object.keys(perfil).length ? [perfil] : []);
  await putCsv("CONFIGURACOES/NOME_DO_PROJETO.csv", [projeto]);
  await putCsv(
    "CONFIGURACOES/INFORMACOES_CONTRATUAIS.csv",
    Object.keys(cabRow).length ? [cabRow] : [],
  );

  const logo = await downloadOwnMedia(admin, supabaseUrl, String(cfgRow.logo_url ?? ""), userId);
  if (logo) {
    await r2Put(r2, `${prefix}/CONFIGURACOES/Logomarca_Global.${logo.ext}`, logo.bytes, logo.contentType);
    files["CONFIGURACOES/Logomarca_Global"] = logo.bytes.byteLength;
  }
  const assinatura = await downloadOwnMedia(
    admin,
    supabaseUrl,
    String(cabRow.assinatura_url ?? ""),
    userId,
  );
  if (assinatura) {
    await r2Put(
      r2,
      `${prefix}/CONFIGURACOES/Assinatura_eletronica.${assinatura.ext}`,
      assinatura.bytes,
      assinatura.contentType,
    );
    files["CONFIGURACOES/Assinatura_eletronica"] = assinatura.bytes.byteLength;
  }

  const anotacoes = await fetchByUser(admin, "anotacoes", userId);
  await putCsv("ANOTACOES/ANOTACOES.csv", anotacoes);

  await admin
    .from("r2_auto_backup_settings")
    .update({
      last_run_at: new Date().toISOString(),
      last_run_date_sp: dateFolder,
      last_status: "ok",
      last_error: null,
      last_stats: stats,
      last_prefix: prefix,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return { ok: true, stats, prefix };
}

async function requireEmpresa(
  authHeader: string | null,
  admin: SupabaseClient,
  supabaseUrl: string,
  anon: string,
): Promise<{ ok: true; userId: string } | { ok: false; response: Response }> {
  if (!authHeader) return { ok: false, response: json({ error: "Não autorizado." }, 401) };
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return { ok: false, response: json({ error: "Não autorizado." }, 401) };
  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await userClient.auth.getUser(jwt);
  const uid = data.user?.id;
  if (error || !uid) return { ok: false, response: json({ error: "Sessão inválida." }, 401) };
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", uid);
  const list = (roles ?? []).map((r: { role: string }) => r.role);
  if (list.includes("admin_master") || !list.includes("admin_transfer")) {
    return { ok: false, response: json({ error: "AUTO BACK-UP é só para a conta da empresa." }, 403) };
  }
  return { ok: true, userId: uid };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const cronSecret =
    Deno.env.get("R2_BACKUP_CRON_SECRET")?.trim() || Deno.env.get("R2_SYNC_SECRET")?.trim() || "";
  const headerSecret = req.headers.get("x-r2-backup-cron-secret")?.trim() ?? "";
  const isCron = Boolean(cronSecret && headerSecret && headerSecret === cronSecret);

  const admin = createClient(supabaseUrl, serviceKey);
  let body: { mode?: string } = {};
  try {
    body = (await req.json()) as { mode?: string };
  } catch {
    body = {};
  }

  try {
    if (isCron || body.mode === "cron") {
      if (!isCron) return json({ error: "Cron secret inválido." }, 401);
      const { data: list, error } = await admin
        .from("r2_auto_backup_settings")
        .select("user_id")
        .eq("enabled", true);
      if (error) return json({ error: error.message }, 500);
      const today = dateFolderSp();
      const results: { user_id: string; ok: boolean; error?: string }[] = [];
      for (const row of list ?? []) {
        const uid = String((row as { user_id: string }).user_id);
        const { data: st } = await admin
          .from("r2_auto_backup_settings")
          .select("last_run_date_sp")
          .eq("user_id", uid)
          .maybeSingle();
        if (st && String((st as { last_run_date_sp: string | null }).last_run_date_sp) === today) {
          results.push({ user_id: uid, ok: true, error: "já copiado hoje" });
          continue;
        }
        try {
          const r = await runForUser(admin, uid, supabaseUrl);
          results.push({ user_id: uid, ok: r.ok });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await admin
            .from("r2_auto_backup_settings")
            .update({
              last_status: "error",
              last_error: msg.slice(0, 2000),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", uid);
          results.push({ user_id: uid, ok: false, error: msg });
        }
      }
      return json({ ok: true, mode: "cron", date: today, results });
    }

    const authz = await requireEmpresa(req.headers.get("Authorization"), admin, supabaseUrl, anon);
    if (!authz.ok) return authz.response;

    const r = await runForUser(admin, authz.userId, supabaseUrl);
    return json({ ok: r.ok, prefix: r.prefix, stats: r.stats, error: r.error ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg }, 500);
  }
});
