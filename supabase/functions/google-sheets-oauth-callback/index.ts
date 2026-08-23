import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { envClients } from "../_shared/googleSheetsAuth.ts";
import {
  BACKUP_SHEETS,
  createBackupSpreadsheet,
  exchangeCodeForTokens,
  fetchGoogleEmail,
} from "../_shared/googleSheets.ts";

function htmlPage(title: string, body: string, redirectUrl?: string): Response {
  const redirectMeta = redirectUrl
    ? `<meta http-equiv="refresh" content="2;url=${redirectUrl.replace(/"/g, "&quot;")}">`
    : "";
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  ${redirectMeta}
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0b0b0c;color:#f5f5f5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
    .card{max-width:420px;padding:2rem;border:1px solid #333;border-radius:16px;background:#141416;text-align:center}
    .ok{color:#FF6600;font-weight:700}
    a{color:#FF6600}
  </style>
</head>
<body><div class="card">${body}</div></body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function successRedirect(): string {
  const base = (Deno.env.get("GOOGLE_OAUTH_SUCCESS_REDIRECT") || "").trim();
  if (base) {
    const u = new URL(base);
    u.searchParams.set("google_sheets", "connected");
    return u.toString();
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const url = new URL(req.url);
    const err = url.searchParams.get("error");
    if (err) {
      return htmlPage(
        "Google Sheets",
        `<p class="ok">Autorização cancelada</p><p>${err}</p><p>Pode fechar esta janela.</p>`,
      );
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) {
      return htmlPage("Google Sheets", `<p>Pedido OAuth inválido (sem code/state).</p>`);
    }

    const { supabaseUrl, serviceKey } = envClients();
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: stRow, error: stErr } = await admin
      .from("google_sheets_oauth_states")
      .select("user_id, created_at")
      .eq("state", state)
      .maybeSingle();

    if (stErr || !stRow) {
      return htmlPage("Google Sheets", `<p>State OAuth inválido ou expirado. Tente novamente no painel.</p>`);
    }

    const created = new Date(stRow.created_at).getTime();
    if (!Number.isFinite(created) || Date.now() - created > 30 * 60 * 1000) {
      await admin.from("google_sheets_oauth_states").delete().eq("state", state);
      return htmlPage("Google Sheets", `<p>State OAuth expirado. Tente conectar novamente.</p>`);
    }

    const userId = stRow.user_id as string;
    await admin.from("google_sheets_oauth_states").delete().eq("state", state);

    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.access_token) {
      return htmlPage("Google Sheets", `<p>Google não devolveu access_token.</p>`);
    }

    const { data: existing } = await admin
      .from("google_sheets_backup_connections")
      .select("refresh_token, spreadsheet_id, spreadsheet_url")
      .eq("user_id", userId)
      .maybeSingle();

    const refreshToken = tokens.refresh_token || existing?.refresh_token;
    if (!refreshToken) {
      return htmlPage(
        "Google Sheets",
        `<p>Sem refresh_token. Remova o acesso à app em <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">Conta Google → Acessos</a> e conecte de novo.</p>`,
      );
    }

    const googleEmail = await fetchGoogleEmail(tokens.access_token);

    let spreadsheetId = existing?.spreadsheet_id as string | undefined;
    let spreadsheetUrl = existing?.spreadsheet_url as string | undefined;

    if (!spreadsheetId) {
      const { data: cfg } = await admin
        .from("configuracoes")
        .select("nome_projeto, nome_completo")
        .eq("user_id", userId)
        .maybeSingle();
      const label =
        (cfg?.nome_projeto as string)?.trim() ||
        (cfg?.nome_completo as string)?.trim() ||
        userId.slice(0, 8);
      const createdSheet = await createBackupSpreadsheet(
        tokens.access_token,
        `E-Transporte Backup — ${label}`,
        BACKUP_SHEETS.map((s) => s.tab),
      );
      spreadsheetId = createdSheet.spreadsheetId;
      spreadsheetUrl = createdSheet.spreadsheetUrl;
    }

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    const { error: upErr } = await admin.from("google_sheets_backup_connections").upsert(
      {
        user_id: userId,
        google_email: googleEmail,
        refresh_token: refreshToken,
        access_token: tokens.access_token,
        access_token_expires_at: expiresAt,
        spreadsheet_id: spreadsheetId,
        spreadsheet_url: spreadsheetUrl,
        auto_sync_enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (upErr) {
      console.error(upErr);
      return htmlPage("Google Sheets", `<p>Erro ao guardar ligação: ${upErr.message}</p>`);
    }

    const redirect = successRedirect();
    return htmlPage(
      "Google Sheets ligado",
      `<p class="ok">Conta Google ligada com sucesso</p>
       <p>${googleEmail ? `Conta: <strong>${googleEmail}</strong>` : ""}</p>
       <p>A planilha de backup foi criada/associada. Pode fechar esta janela e voltar ao painel.</p>
       ${redirect ? `<p><a href="${redirect}">Voltar ao painel</a></p>` : ""}`,
      redirect || undefined,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    return htmlPage("Google Sheets", `<p>Erro: ${msg}</p>`);
  }
});
