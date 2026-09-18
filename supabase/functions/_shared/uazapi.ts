/** Cliente HTTP da uazapiGO v2 (https://docs.uazapi.com/). */

export type UazapiJson = Record<string, unknown>;

export function uazapiRoot(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function adminHeaders(adminToken: string, json = false): Record<string, string> {
  const h: Record<string, string> = { admintoken: adminToken };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export function instanceHeaders(instanceToken: string, json = false): Record<string, string> {
  const h: Record<string, string> = { token: instanceToken };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export async function uazapiFetch(
  url: string,
  init: RequestInit,
): Promise<{ status: number; text: string; json: unknown }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}

function walkStrings(data: unknown, keys: string[]): string | null {
  if (!data || typeof data !== "object") return null;
  const stack: unknown[] = [data];
  const seen = new Set<unknown>();
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
    seen.add(cur);
    const o = cur as Record<string, unknown>;
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    for (const v of Object.values(o)) {
      if (v && typeof v === "object") stack.push(v);
    }
  }
  return null;
}

export function extractUazapiToken(data: unknown): string | null {
  return walkStrings(data, ["token", "instanceToken", "instance_token"]);
}

export function extractUazapiName(data: unknown): string | null {
  return walkStrings(data, ["name", "instanceName", "instance_name"]);
}

export function extractUazapiStatus(data: unknown): string | null {
  const s = walkStrings(data, ["status", "state", "connectionStatus"]);
  return s ? s.toLowerCase() : null;
}

/** QR em data URL ou base64 cru. */
export function extractUazapiQrBase64(data: unknown): string | null {
  const raw = walkStrings(data, ["qrcode", "qrCode", "qr_code", "base64", "qrOrCode"]);
  if (!raw || raw.length < 40) return null;
  if (raw.startsWith("data:image")) return raw;
  const cleaned = raw.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
  if (cleaned.length > 40) return cleaned;
  return null;
}

export function isUazapiConnected(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "connected" || s === "open" || s === "conectado" || s === "online";
}

export function findInstanceInAllList(list: unknown, instanceName: string): unknown | null {
  const arr = Array.isArray(list) ? list : list ? [list] : [];
  for (const item of arr) {
    const n = extractUazapiName(item);
    if (n === instanceName) return item;
  }
  return null;
}

export async function uazapiInitInstance(
  root: string,
  adminToken: string,
  name: string,
  systemName: string,
): Promise<{ status: number; text: string; json: unknown }> {
  return await uazapiFetch(`${root}/instance/init`, {
    method: "POST",
    headers: adminHeaders(adminToken, true),
    body: JSON.stringify({ name, systemName }),
  });
}

export async function uazapiListInstances(
  root: string,
  adminToken: string,
): Promise<{ status: number; text: string; json: unknown }> {
  return await uazapiFetch(`${root}/instance/all`, {
    method: "GET",
    headers: adminHeaders(adminToken),
  });
}

export async function uazapiConnectQr(
  root: string,
  instanceToken: string,
): Promise<{ status: number; text: string; json: unknown }> {
  return await uazapiFetch(`${root}/instance/connect`, {
    method: "POST",
    headers: instanceHeaders(instanceToken, true),
    body: JSON.stringify({}),
  });
}

export async function uazapiStatus(
  root: string,
  instanceToken: string,
): Promise<{ status: number; text: string; json: unknown }> {
  return await uazapiFetch(`${root}/instance/status`, {
    method: "GET",
    headers: instanceHeaders(instanceToken),
  });
}

export async function uazapiDeleteInstance(
  root: string,
  instanceToken: string,
): Promise<{ status: number; text: string; json: unknown }> {
  return await uazapiFetch(`${root}/instance`, {
    method: "DELETE",
    headers: instanceHeaders(instanceToken),
  });
}

export async function uazapiSendButtons(
  root: string,
  instanceToken: string,
  number: string,
  text: string,
  buttons: Array<{ id: string; text: string }>,
): Promise<{ status: number; text: string; json: unknown }> {
  return await uazapiFetch(`${root}/send/buttons`, {
    method: "POST",
    headers: instanceHeaders(instanceToken, true),
    body: JSON.stringify({
      number,
      text,
      buttons: buttons.map((b) => ({ id: b.id, text: b.text })),
    }),
  });
}

export async function uazapiSendText(
  root: string,
  instanceToken: string,
  number: string,
  text: string,
): Promise<{ status: number; text: string; json: unknown }> {
  return await uazapiFetch(`${root}/send/text`, {
    method: "POST",
    headers: instanceHeaders(instanceToken, true),
    body: JSON.stringify({ number, text }),
  });
}

export async function uazapiSendMedia(
  root: string,
  instanceToken: string,
  number: string,
  payload: Record<string, unknown>,
): Promise<{ status: number; text: string; json: unknown }> {
  return await uazapiFetch(`${root}/send/media`, {
    method: "POST",
    headers: instanceHeaders(instanceToken, true),
    body: JSON.stringify({ number, ...payload }),
  });
}

export async function uazapiChatFind(
  root: string,
  instanceToken: string,
  body: Record<string, unknown> = {},
): Promise<{ status: number; text: string; json: unknown }> {
  return await uazapiFetch(`${root}/chat/find`, {
    method: "POST",
    headers: instanceHeaders(instanceToken, true),
    body: JSON.stringify(body),
  });
}

export async function uazapiMessageFind(
  root: string,
  instanceToken: string,
  body: Record<string, unknown>,
): Promise<{ status: number; text: string; json: unknown }> {
  return await uazapiFetch(`${root}/message/find`, {
    method: "POST",
    headers: instanceHeaders(instanceToken, true),
    body: JSON.stringify(body),
  });
}

export async function uazapiSendDocument(
  root: string,
  instanceToken: string,
  number: string,
  filename: string,
  base64: string,
): Promise<{ status: number; text: string; json: unknown }> {
  const raw = base64.includes(",") ? base64.split(",").pop() || base64 : base64;
  return await uazapiFetch(`${root}/send/media`, {
    method: "POST",
    headers: instanceHeaders(instanceToken, true),
    body: JSON.stringify({
      number,
      type: "document",
      file: `data:application/pdf;base64,${raw}`,
      docName: filename,
      text: filename,
    }),
  });
}
