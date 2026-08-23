/** Helpers Google OAuth + Sheets para Edge Functions de backup. */

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export type BackupSheetDef = {
  tab: string;
  table: string;
  /** Colunas a omitir (secrets / payloads grandes / PII técnica). */
  omit?: string[];
  /** Se true, filtra por user_id = tenant. Default true. */
  byUserId?: boolean;
};

/** Abas exportadas por empresa (fonte da verdade = Postgres). */
export const BACKUP_SHEETS: BackupSheetDef[] = [
  { tab: "Reservas_Transfer", table: "reservas_transfer" },
  { tab: "Reservas_Grupos", table: "reservas_grupos" },
  { tab: "Solicitacoes_Transfer", table: "solicitacoes_transfer" },
  { tab: "Solicitacoes_Grupos", table: "solicitacoes_grupos" },
  { tab: "Motoristas", table: "solicitacoes_motoristas" },
  { tab: "Veiculos_Frota", table: "veiculos_frota" },
  { tab: "Clientes", table: "cadastro_clientes" },
  { tab: "Financeiro", table: "financial_transactions" },
  { tab: "Receptivos", table: "receptivos" },
  { tab: "Rastreios", table: "rastreios_ao_vivo" },
  { tab: "Contratos", table: "contratos" },
  { tab: "Configuracoes", table: "configuracoes" },
  { tab: "Cabecalho_Contratual", table: "cabecalho_contratual" },
  { tab: "Dominios", table: "dominios_usuario" },
  { tab: "Automacoes", table: "automacoes" },
  { tab: "QR_Codes", table: "qr_codes" },
  { tab: "Catalogos_Motorista", table: "catalogos_motorista" },
];

export function getGoogleOAuthConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = (Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") || "").trim();
  const clientSecret = (Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || "").trim();
  const redirectUri = (Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI") || "").trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Secrets Google em falta: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function buildGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri } = getGoogleOAuthConfig();
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", GOOGLE_SCOPES);
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", state);
  return u.toString();
}

export type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${json.error || res.status} ${json.error_description || ""}`);
  }
  return json as GoogleTokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Refresh token failed: ${json.error || res.status} ${json.error_description || ""}`);
  }
  return json as GoogleTokenResponse;
}

export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  } catch {
    /* best-effort */
  }
}

export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { email?: string };
  return json.email?.trim() || null;
}

export function cellValue(v: unknown): string | number | boolean {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "bigint") return v.toString();
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function rowsToSheetValues(rows: Record<string, unknown>[]): (string | number | boolean)[][] {
  if (!rows.length) return [["(sem registos)"]];
  const keys = Object.keys(rows[0]);
  const header = keys;
  const data = rows.map((r) => keys.map((k) => cellValue(r[k])));
  return [header, ...data];
}

async function sheetsFetch(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  return res;
}

export async function createBackupSpreadsheet(
  accessToken: string,
  title: string,
  tabNames: string[],
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const sheets = tabNames.map((title, i) => ({
    properties: {
      title,
      index: i,
      gridProperties: { frozenRowCount: 1 },
    },
  }));

  const res = await sheetsFetch(accessToken, "https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    body: JSON.stringify({
      properties: { title },
      sheets,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Create spreadsheet failed: ${JSON.stringify(json)}`);
  }
  const spreadsheetId = String(json.spreadsheetId);
  const spreadsheetUrl =
    json.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  return { spreadsheetId, spreadsheetUrl };
}

export async function ensureSheetTabs(
  accessToken: string,
  spreadsheetId: string,
  tabNames: string[],
): Promise<void> {
  const metaRes = await sheetsFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
  );
  const meta = await metaRes.json();
  if (!metaRes.ok) throw new Error(`Sheets meta failed: ${JSON.stringify(meta)}`);

  const existing = new Set<string>(
    ((meta.sheets || []) as Array<{ properties?: { title?: string } }>).map(
      (s) => s.properties?.title || "",
    ),
  );
  const missing = tabNames.filter((t) => !existing.has(t));
  if (!missing.length) return;

  const requests = missing.map((title) => ({
    addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } },
  }));
  const res = await sheetsFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    { method: "POST", body: JSON.stringify({ requests }) },
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`addSheet failed: ${JSON.stringify(err)}`);
  }
}

/** Limpa e escreve uma aba (chunked). */
export async function rewriteSheetTab(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  values: (string | number | boolean)[][],
): Promise<number> {
  const encoded = encodeURIComponent(tabName);
  const clearRes = await sheetsFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encoded}:clear`,
    { method: "POST", body: "{}" },
  );
  if (!clearRes.ok) {
    const err = await clearRes.json();
    throw new Error(`clear ${tabName}: ${JSON.stringify(err)}`);
  }

  if (!values.length) return 0;

  const CHUNK = 4000;
  let written = 0;
  for (let i = 0; i < values.length; i += CHUNK) {
    const chunk = values.slice(i, i + CHUNK);
    const range =
      i === 0
        ? `${tabName}!A1`
        : `${tabName}!A${i + 1}`;
    const encRange = encodeURIComponent(range);
    const res = await sheetsFetch(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encRange}?valueInputOption=RAW`,
      {
        method: "PUT",
        body: JSON.stringify({ range, majorDimension: "ROWS", values: chunk }),
      },
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`update ${tabName}: ${JSON.stringify(err)}`);
    }
    written += chunk.length;
  }
  return written;
}
