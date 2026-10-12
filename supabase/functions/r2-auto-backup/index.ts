/**
 * Registro R2 por empresa.
 * A cópia inicial grava um arquivo por registro.
 * Depois disso, cada salvamento regrava só esse arquivo e cada exclusão apaga só esse arquivo.
 * Prefixo estável: backups/{empresa}__{userId8}/registros/{tabela}/{id}.json
 * As pastas antigas por data não são apagadas.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { espelhoKey, organizedKey, r2Client, r2Delete, r2List, r2Put } from "./r2.ts";
import {
  chunkRows,
  incrementFileName,
  nextBackupCursor,
  runStampSp,
  toBackupIso,
} from "./incremental.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-r2-backup-cron-secret",
};

const CHUNK = 250;
const PAGE = 80;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REGISTRO_TABLES = [
  "veiculos_frota",
  "solicitacoes_motoristas",
  "cadastro_clientes",
  "reservas_transfer",
  "solicitacoes_transfer",
  "reservas_grupos",
  "solicitacoes_grupos",
  "anotacoes",
  "financial_transactions",
  "contratos",
  "automacoes",
  "receptivos",
  "configuracoes",
  "cabecalho_contratual",
] as const;

const SINGLETON_TABLES = new Set<string>(["configuracoes", "cabecalho_contratual"]);

const MEDIA_BUCKET_BY_TABLE: Record<string, string> = {
  veiculos_frota: "veiculos-imagens",
  solicitacoes_motoristas: "motorista-frota-docs",
  cadastro_clientes: "cadastro-clientes-docs",
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
  const lines = [keys.join(","), ...rows.map((r) => keys.map((k) => csvEscape(r[k])).join(","))];
  return encoder.encode(`\uFEFF${lines.join("\r\n")}`);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchByUser(
  admin: SupabaseClient,
  table: string,
  userId: string,
  opts?: {
    eq?: { col: string; val: string };
    neq?: { col: string; val: string };
    since?: string | null;
  },
): Promise<Record<string, unknown>[]> {
  const pageSize = 500;
  const out: Record<string, unknown>[] = [];
  let from = 0;
  for (;;) {
    let q = admin.from(table).select("*").eq("user_id", userId);
    if (opts?.eq) q = q.eq(opts.eq.col, opts.eq.val);
    if (opts?.neq) q = q.neq(opts.neq.col, opts.neq.val);
    if (opts?.since) {
      q = q.or(`updated_at.gt.${opts.since},created_at.gt.${opts.since}`);
    }
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

function readCursor(cursors: Record<string, unknown>, key: string, fallback: string | null): string | null {
  return toBackupIso(cursors[key]) ?? fallback;
}

async function markSettings(
  admin: SupabaseClient,
  userId: string,
  patch: Record<string, unknown>,
) {
  const { data: existing } = await admin
    .from("r2_auto_backup_settings")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    await admin.from("r2_auto_backup_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq(
      "user_id",
      userId,
    );
    return;
  }
  await admin.from("r2_auto_backup_settings").insert({
    user_id: userId,
    enabled: true,
    ...patch,
  });
}

async function runForUser(
  admin: SupabaseClient,
  userId: string,
  supabaseUrl: string,
): Promise<{ ok: boolean; stats: Record<string, unknown>; prefix: string }> {
  const { data: cfg } = await admin.from("configuracoes").select("*").eq("user_id", userId).maybeSingle();
  const { data: cab } = await admin.from("cabecalho_contratual").select("*").eq("user_id", userId).maybeSingle();
  const cfgRow = (cfg ?? {}) as Record<string, unknown>;
  const cabRow = (cab ?? {}) as Record<string, unknown>;
  const empresaNome = String(
    cfgRow.nome_empresa || cfgRow.nome_projeto || cabRow.razao_social || cabRow.nome || "empresa",
  );
  const dateFolder = dateFolderSp();
  const stamp = runStampSp();
  const prefix = `backups/${slugEmpresa(empresaNome, userId)}/${dateFolder}`;
  const stats: Record<string, unknown> = {
    prefix,
    date: dateFolder,
    files: {},
    skipped: [],
    incremental: true,
  };
  const files = stats.files as Record<string, number>;
  const skipped = stats.skipped as string[];

  const { data: existing } = await admin
    .from("r2_auto_backup_settings")
    .select("enabled, last_file_hashes, last_row_cursors, last_run_at")
    .eq("user_id", userId)
    .maybeSingle();
  const hashes: Record<string, string> = {
    ...(((existing?.last_file_hashes as Record<string, string> | null) ?? {})),
  };
  const cursors: Record<string, string | null> = {};
  const rawCursors = ((existing?.last_row_cursors as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const fallbackCursor = toBackupIso(existing?.last_run_at ?? null);

  await markSettings(admin, userId, { last_status: "running", last_error: null });

  const r2 = await r2Client();

  const putBytes = async (rel: string, bytes: Uint8Array, contentType: string) => {
    const fp = await sha256Hex(bytes);
    if (hashes[rel] === fp) {
      skipped.push(rel);
      return;
    }
    await r2Put(r2, `${prefix}/${rel}`, bytes, contentType);
    hashes[rel] = fp;
    files[rel] = bytes.byteLength;
  };

  const putChangedTable = async (
    cursorKey: string,
    relCsv: string,
    rows: Record<string, unknown>[],
  ) => {
    const prev = readCursor(rawCursors, cursorKey, fallbackCursor);
    if (!rows.length) {
      skipped.push(relCsv);
      cursors[cursorKey] = nextBackupCursor(prev, []) ?? prev;
      return;
    }
    const firstFull = !prev;
    const dest = firstFull ? relCsv : incrementFileName(relCsv, stamp);
    const parts = chunkRows(rows, CHUNK);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const rel = parts.length === 1 ? dest : dest.replace(/\.csv$/i, `__parte-${String(i + 1).padStart(3, "0")}.csv`);
      await r2Put(r2, `${prefix}/${rel}`, toCsv(part), "text/csv; charset=utf-8");
      files[rel] = part.length;
    }
    cursors[cursorKey] = nextBackupCursor(prev, rows);
  };

  await putChangedTable(
    "solicitacoes_transfer",
    "TRANSFER/SOLICITACOES.csv",
    await fetchByUser(admin, "solicitacoes_transfer", userId, {
      since: readCursor(rawCursors, "solicitacoes_transfer", fallbackCursor),
    }),
  );
  await putChangedTable(
    "reservas_transfer",
    "TRANSFER/RESERVAS.csv",
    await fetchByUser(admin, "reservas_transfer", userId, {
      since: readCursor(rawCursors, "reservas_transfer", fallbackCursor),
    }),
  );
  await putChangedTable(
    "solicitacoes_grupos",
    "GRUPOS/SOLICITACOES.csv",
    await fetchByUser(admin, "solicitacoes_grupos", userId, {
      since: readCursor(rawCursors, "solicitacoes_grupos", fallbackCursor),
    }),
  );
  await putChangedTable(
    "reservas_grupos",
    "GRUPOS/RESERVAS.csv",
    await fetchByUser(admin, "reservas_grupos", userId, {
      since: readCursor(rawCursors, "reservas_grupos", fallbackCursor),
    }),
  );
  await putChangedTable(
    "solicitacoes_motoristas_cad",
    "MOTORISTAS/CADASTROS.csv",
    await fetchByUser(admin, "solicitacoes_motoristas", userId, {
      eq: { col: "status", val: "cadastrado" },
      since: readCursor(rawCursors, "solicitacoes_motoristas_cad", fallbackCursor),
    }),
  );
  await putChangedTable(
    "solicitacoes_motoristas_sol",
    "MOTORISTAS/SOLICITACOES.csv",
    await fetchByUser(admin, "solicitacoes_motoristas", userId, {
      neq: { col: "status", val: "cadastrado" },
      since: readCursor(rawCursors, "solicitacoes_motoristas_sol", fallbackCursor),
    }),
  );
  await putChangedTable(
    "cadastro_clientes",
    "CLIENTES/CLIENTES.csv",
    await fetchByUser(admin, "cadastro_clientes", userId, {
      since: readCursor(rawCursors, "cadastro_clientes", fallbackCursor),
    }),
  );
  await putChangedTable(
    "veiculos_frota",
    "VEICULOS/VEICULOS.csv",
    await fetchByUser(admin, "veiculos_frota", userId, {
      since: readCursor(rawCursors, "veiculos_frota", fallbackCursor),
    }),
  );

  await putBytes(
    "CONFIGURACOES/MEU_PERFIL.csv",
    toCsv(Object.keys(cfgRow).length ? [cfgRow] : []),
    "text/csv; charset=utf-8",
  );
  await putBytes(
    "CONFIGURACOES/NOME_DO_PROJETO.csv",
    toCsv([{
      nome_projeto: cfgRow.nome_projeto ?? "",
      fonte_global: cfgRow.fonte_global ?? "",
      logo_url: cfgRow.logo_url ?? "",
    }]),
    "text/csv; charset=utf-8",
  );
  await putBytes(
    "CONFIGURACOES/INFORMACOES_CONTRATUAIS.csv",
    toCsv(Object.keys(cabRow).length ? [cabRow] : []),
    "text/csv; charset=utf-8",
  );

  const logo = await downloadOwnMedia(admin, supabaseUrl, String(cfgRow.logo_url ?? ""), userId);
  if (logo) await putBytes(`CONFIGURACOES/Logomarca_Global.${logo.ext}`, logo.bytes, logo.contentType);
  const assinatura = await downloadOwnMedia(admin, supabaseUrl, String(cabRow.assinatura_url ?? ""), userId);
  if (assinatura) {
    await putBytes(`CONFIGURACOES/Assinatura_eletronica.${assinatura.ext}`, assinatura.bytes, assinatura.contentType);
  }

  await putChangedTable(
    "anotacoes",
    "ANOTACOES/ANOTACOES.csv",
    await fetchByUser(admin, "anotacoes", userId, {
      since: readCursor(rawCursors, "anotacoes", fallbackCursor),
    }),
  );

  await markSettings(admin, userId, {
    last_run_at: new Date().toISOString(),
    last_run_date_sp: dateFolder,
    last_status: "ok",
    last_error: null,
    last_stats: stats,
    last_prefix: prefix,
    last_file_hashes: hashes,
    last_row_cursors: cursors,
  });

  return { ok: true, stats, prefix };
}

function isRegistroTable(table: string): boolean {
  return (REGISTRO_TABLES as readonly string[]).includes(table);
}

function statsOf(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
}

async function loadSettings(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from("r2_auto_backup_settings")
    .select("enabled, last_stats, last_prefix")
    .eq("user_id", userId)
    .maybeSingle();
  return data as { enabled?: boolean; last_stats?: unknown; last_prefix?: string | null } | null;
}

async function registroPrefix(admin: SupabaseClient, userId: string): Promise<string> {
  const existing = await loadSettings(admin, userId);
  const saved = statsOf(existing?.last_stats).registro_prefix;
  if (typeof saved === "string" && /^backups\/[a-zA-Z0-9_-]+\/registros$/.test(saved)) return saved;
  const { data: cfg } = await admin.from("configuracoes").select("nome_empresa, nome_projeto").eq("user_id", userId).maybeSingle();
  const { data: cab } = await admin.from("cabecalho_contratual").select("razao_social, nome").eq("user_id", userId).maybeSingle();
  const cfgRow = (cfg ?? {}) as Record<string, unknown>;
  const cabRow = (cab ?? {}) as Record<string, unknown>;
  const empresaNome = String(cfgRow.nome_empresa || cfgRow.nome_projeto || cabRow.razao_social || cabRow.nome || "empresa");
  return `backups/${slugEmpresa(empresaNome, userId)}/registros`;
}

function recordObjectKey(prefix: string, table: string, id: string): string {
  if (!isRegistroTable(table) || !UUID_RE.test(id)) throw new Error("Registro inválido.");
  return `${prefix}/${table}/${id}.json`;
}

async function fetchOwnedRow(
  admin: SupabaseClient,
  table: string,
  userId: string,
  id: string | null,
): Promise<Record<string, unknown> | null> {
  let q = admin.from(table).select("*").eq("user_id", userId);
  if (!SINGLETON_TABLES.has(table)) {
    if (!id || !UUID_RE.test(id)) throw new Error("Id inválido.");
    q = q.eq("id", id);
  }
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data as Record<string, unknown> | null) ?? null;
}

async function putRecord(
  admin: SupabaseClient,
  userId: string,
  table: string,
  id: string | null,
): Promise<{ key: string; skipped?: string }> {
  const settings = await loadSettings(admin, userId);
  if (!settings?.enabled) return { key: "", skipped: "desligado" };
  const row = await fetchOwnedRow(admin, table, userId, id);
  if (!row) return { key: "", skipped: "sem-registro" };
  const rowId = String(row.id ?? "");
  if (!UUID_RE.test(rowId)) throw new Error("Registro sem id.");
  const prefix = await registroPrefix(admin, userId);
  const key = recordObjectKey(prefix, table, rowId);
  const bytes = new TextEncoder().encode(JSON.stringify(row));
  const r2 = await r2Client();
  await r2Put(r2, key, bytes, "application/json; charset=utf-8");
  const stats = statsOf(settings.last_stats);
  stats.registro_prefix = prefix;
  await markSettings(admin, userId, {
    last_run_at: new Date().toISOString(),
    last_status: "ok",
    last_error: null,
    last_prefix: prefix,
    last_stats: stats,
  });
  return { key };
}

async function snapshotPage(
  admin: SupabaseClient,
  userId: string,
  table: string,
  offset: number,
): Promise<{ done: boolean; table: string; offset: number; written: number; prefix: string }> {
  const settings = await loadSettings(admin, userId);
  if (!settings?.enabled) throw new Error("Ligue o registro antes da cópia inicial.");
  const stats = statsOf(settings.last_stats);
  if (typeof stats.snapshot_completed_at === "string" && stats.snapshot_completed_at) {
    return { done: true, table, offset: 0, written: 0, prefix: await registroPrefix(admin, userId) };
  }
  const prefix = await registroPrefix(admin, userId);
  const from = Math.max(0, offset);
  const { data, error } = await admin
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .order("id", { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) throw new Error(`${table}: ${error.message}`);
  const rows = (data ?? []) as Record<string, unknown>[];
  const r2 = rows.length ? await r2Client() : null;
  for (const row of rows) {
    const rowId = String(row.id ?? "");
    if (!UUID_RE.test(rowId) || !r2) continue;
    const bytes = new TextEncoder().encode(JSON.stringify(row));
    await r2Put(r2, recordObjectKey(prefix, table, rowId), bytes, "application/json; charset=utf-8");
  }
  const tableIndex = REGISTRO_TABLES.indexOf(table as (typeof REGISTRO_TABLES)[number]);
  if (tableIndex < 0) throw new Error("Tabela não registrada.");
  const tableDone = rows.length < PAGE;
  const nextIndex = tableDone ? tableIndex + 1 : tableIndex;
  const finished = tableDone && nextIndex >= REGISTRO_TABLES.length;
  stats.registro_prefix = prefix;
  if (finished) stats.snapshot_completed_at = new Date().toISOString();
  else delete stats.snapshot_completed_at;
  await markSettings(admin, userId, {
    ...(finished ? { last_run_at: new Date().toISOString() } : {}),
    last_status: "ok",
    last_error: null,
    last_prefix: prefix,
    last_stats: stats,
  });
  if (finished) return { done: true, table, offset: from + rows.length, written: rows.length, prefix };
  const nextTable = tableDone ? REGISTRO_TABLES[nextIndex]! : table;
  return { done: false, table: nextTable, offset: tableDone ? 0 : from + rows.length, written: rows.length, prefix };
}

async function deleteOwnedObjects(
  admin: SupabaseClient,
  userId: string,
  table: string,
  id: string,
): Promise<{ json: string; media: number }> {
  if (!isRegistroTable(table) || !UUID_RE.test(id) || !UUID_RE.test(userId)) throw new Error("Registro inválido.");
  const prefix = await registroPrefix(admin, userId);
  const key = recordObjectKey(prefix, table, id);
  const r2 = await r2Client();
  await r2Delete(r2, key);
  let media = 0;
  const bucket = MEDIA_BUCKET_BY_TABLE[table];
  if (bucket) {
    const folder = `${userId}/${id}/`;
    const listPrefix = espelhoKey(bucket, folder);
    const keys = await r2List(r2, listPrefix);
    const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows ?? []).map((row) => String((row as { role?: string }).role ?? ""));
    const roleByUser: Record<string, string> = {
      [userId]: roles.includes("admin_transfer") ? "admin_transfer" : roles[0] || "sem-papel",
    };
    for (const found of keys) {
      if (!found.startsWith(listPrefix)) continue;
      await r2Delete(r2, found);
      const objectPath = found.slice(`espelho/${bucket}/`.length);
      if (!objectPath.startsWith(folder)) continue;
      const organized = organizedKey(bucket, objectPath, roleByUser);
      if (organized !== found) await r2Delete(r2, organized);
      media += 1;
    }
    const { data: stored } = await admin.storage.from(bucket).list(`${userId}/${id}`, { limit: 100 });
    const paths = (stored ?? [])
      .map((item) => item.name)
      .filter((name) => name && !name.includes("/") && !name.includes(".."))
      .map((name) => `${userId}/${id}/${name}`);
    if (paths.length) await admin.storage.from(bucket).remove(paths);
  }
  return { json: key, media };
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
  let body: { mode?: string; table?: string; id?: string; offset?: number } = {};
  try {
    body = (await req.json()) as { mode?: string; table?: string; id?: string; offset?: number };
  } catch {
    body = {};
  }

  try {
    if (isCron || body.mode === "cron" || body.mode === "manual") {
      if ((body.mode === "cron" || isCron) && !isCron) return json({ error: "Cron secret inválido." }, 401);
      return json({ ok: true, skipped: true, reason: "Nada mudou. Só a cópia inicial e cada salvamento enviam arquivos." });
    }

    const authz = await requireEmpresa(req.headers.get("Authorization"), admin, supabaseUrl, anon);
    if (!authz.ok) return authz.response;

    const mode = body.mode === "upsert" || body.mode === "purge" ? body.mode : "snapshot";
    try {
      if (mode === "upsert") {
        const table = String(body.table ?? "");
        if (!isRegistroTable(table)) return json({ error: "Tabela não registrada." }, 400);
        const result = await putRecord(admin, authz.userId, table, body.id ?? null);
        return json({ ok: true, ...result });
      }
      if (mode === "purge") {
        const table = String(body.table ?? "");
        const id = String(body.id ?? "");
        if (!isRegistroTable(table) || !UUID_RE.test(id)) return json({ error: "Registro inválido." }, 400);
        const result = await deleteOwnedObjects(admin, authz.userId, table, id);
        return json({ ok: true, ...result });
      }
      const requested = String(body.table ?? REGISTRO_TABLES[0]);
      const table = isRegistroTable(requested) ? requested : REGISTRO_TABLES[0];
      const page = await snapshotPage(admin, authz.userId, table, Number(body.offset ?? 0));
      return json({ ok: true, ...page });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await markSettings(admin, authz.userId, { last_status: "error", last_error: msg.slice(0, 2000) });
      return json({ ok: false, error: msg }, 500);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: msg }, 500);
  }
});
