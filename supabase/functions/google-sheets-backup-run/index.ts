/**
 * Executa backup completo de um tenant para a planilha Google Sheets.
 * Invocado pelo painel (JWT empresa) ou pelo cron (header x-google-sheets-cron-secret).
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, requireAdminTransfer, envClients } from "../_shared/googleSheetsAuth.ts";
import {
  BACKUP_SHEETS,
  ensureSheetTabs,
  refreshAccessToken,
  rewriteSheetTab,
  rowsToSheetValues,
  type BackupSheetDef,
} from "../_shared/googleSheets.ts";

type ConnRow = {
  user_id: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  spreadsheet_id: string;
  spreadsheet_url: string | null;
  auto_sync_enabled: boolean;
};

async function fetchTenantTable(
  admin: SupabaseClient,
  table: string,
  userId: string,
  omit: string[] = [],
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const pageSize = 1000;
  const out: Record<string, unknown>[] = [];
  const omitSet = new Set(omit);
  let from = 0;
  let orderCol: "created_at" | "id" = "created_at";

  for (;;) {
    // deno-lint-ignore no-explicit-any
    let q: any = admin.from(table).select("*").eq("user_id", userId);
    q = q.order(orderCol, { ascending: false });
    let { data, error } = await q.range(from, from + pageSize - 1);

    if (error && orderCol === "created_at") {
      orderCol = "id";
      // deno-lint-ignore no-explicit-any
      q = admin.from(table).select("*").eq("user_id", userId).order("id", { ascending: true });
      ({ data, error } = await q.range(from, from + pageSize - 1));
    }

    if (error) {
      return { rows: out, error: error.message };
    }

    const chunk = ((data || []) as Record<string, unknown>[]).map((row) => {
      if (!omitSet.size) return row;
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (!omitSet.has(k)) clean[k] = v;
      }
      return clean;
    });
    out.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
    if (from > 100_000) break;
  }

  return { rows: out, error: null };
}

async function ensureFreshAccessToken(
  admin: SupabaseClient,
  conn: ConnRow,
): Promise<string> {
  const expires = conn.access_token_expires_at
    ? new Date(conn.access_token_expires_at).getTime()
    : 0;
  const stillValid =
    conn.access_token &&
    Number.isFinite(expires) &&
    expires - Date.now() > 60_000;

  if (stillValid && conn.access_token) return conn.access_token;

  const tokens = await refreshAccessToken(conn.refresh_token);
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  await admin
    .from("google_sheets_backup_connections")
    .update({
      access_token: tokens.access_token,
      access_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", conn.user_id);

  return tokens.access_token;
}

async function runBackupForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ok: boolean; stats: Record<string, unknown>; error?: string }> {
  const { data: conn, error: cErr } = await admin
    .from("google_sheets_backup_connections")
    .select(
      "user_id, refresh_token, access_token, access_token_expires_at, spreadsheet_id, spreadsheet_url, auto_sync_enabled",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (cErr || !conn) {
    return { ok: false, stats: {}, error: "Ligação Google Sheets não encontrada." };
  }

  const row = conn as ConnRow;

  await admin
    .from("google_sheets_backup_connections")
    .update({
      last_sync_status: "running",
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  try {
    const accessToken = await ensureFreshAccessToken(admin, row);
    const tabNames = BACKUP_SHEETS.map((s) => s.tab);
    await ensureSheetTabs(accessToken, row.spreadsheet_id, tabNames);

    const perSheet: Record<string, { rows: number; error?: string }> = {};
    let failures = 0;

    for (const def of BACKUP_SHEETS as BackupSheetDef[]) {
      const { rows, error } = await fetchTenantTable(admin, def.table, userId, def.omit || []);
      if (error && !rows.length) {
        perSheet[def.tab] = { rows: 0, error };
        failures++;
        await rewriteSheetTab(accessToken, row.spreadsheet_id, def.tab, [
          ["erro"],
          [error],
        ]);
        continue;
      }
      const values = rowsToSheetValues(rows);
      const written = await rewriteSheetTab(
        accessToken,
        row.spreadsheet_id,
        def.tab,
        values,
      );
      perSheet[def.tab] = {
        rows: Math.max(0, written - 1),
        ...(error ? { error: `parcial: ${error}` } : {}),
      };
      if (error) failures++;
    }

    const status = failures === 0 ? "ok" : failures === BACKUP_SHEETS.length ? "error" : "partial";
    const stats = {
      sheets: perSheet,
      finished_at: new Date().toISOString(),
      spreadsheet_id: row.spreadsheet_id,
    };

    await admin
      .from("google_sheets_backup_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: status,
        last_sync_error: failures ? `${failures} aba(s) com erro ou aviso` : null,
        last_sync_stats: stats,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return { ok: status !== "error", stats, error: failures ? `${failures} falha(s)` : undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin
      .from("google_sheets_backup_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "error",
        last_sync_error: msg.slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    return { ok: false, stats: {}, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const cronSecret = (Deno.env.get("GOOGLE_SHEETS_CRON_SECRET") || "").trim();
    const headerSecret = (req.headers.get("x-google-sheets-cron-secret") || "").trim();
    const isCron = Boolean(cronSecret && headerSecret && headerSecret === cronSecret);

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode || (isCron ? "cron" : "manual"));

    if (isCron || mode === "cron") {
      if (!isCron) {
        return json(401, { error: "Cron secret inválido" });
      }
      const { supabaseUrl, serviceKey } = envClients();
      const admin = createClient(supabaseUrl, serviceKey);
      const { data: list, error } = await admin
        .from("google_sheets_backup_connections")
        .select("user_id")
        .eq("auto_sync_enabled", true);

      if (error) return json(500, { error: error.message });

      const results: Array<{ user_id: string; ok: boolean; error?: string }> = [];
      for (const item of list || []) {
        const uid = item.user_id as string;
        const r = await runBackupForUser(admin, uid);
        results.push({ user_id: uid, ok: r.ok, error: r.error });
      }
      return json(200, { mode: "cron", processed: results.length, results });
    }

    const auth = await requireAdminTransfer(req.headers.get("Authorization"));
    if (!auth.ok) return auth.response;

    const result = await runBackupForUser(auth.admin, auth.userId);
    if (!result.ok && result.error === "Ligação Google Sheets não encontrada.") {
      return json(404, { error: result.error });
    }
    return json(result.ok ? 200 : 207, {
      ok: result.ok,
      stats: result.stats,
      error: result.error ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    return json(500, { error: msg });
  }
});
