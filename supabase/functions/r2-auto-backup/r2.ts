import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

export const R2_BUCKET = Deno.env.get("R2_BUCKET")?.trim() || "e-transporte";
export const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")?.trim() || "97ffef1ae71def38ec8915c7c530fbd8";

export function r2Endpoint(): string {
  if (!R2_ACCOUNT_ID) throw new Error("R2_ACCOUNT_ID em falta.");
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

function r2ClientWith(accessKeyId: string, secretAccessKey: string): AwsClient {
  const id = accessKeyId.trim();
  const secret = secretAccessKey.trim();
  if (!id || !secret) {
    throw new Error("Credenciais R2 em falta (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY).");
  }
  return new AwsClient({
    accessKeyId: id,
    secretAccessKey: secret,
    service: "s3",
    region: "auto",
  });
}

export async function r2Client(): Promise<AwsClient> {
  const fromEnvId = Deno.env.get("R2_ACCESS_KEY_ID")?.trim() || "";
  const fromEnvSecret = Deno.env.get("R2_SECRET_ACCESS_KEY")?.trim() || "";
  if (fromEnvId && fromEnvSecret) return r2ClientWith(fromEnvId, fromEnvSecret);
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Credenciais R2 em falta (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY).");
  }
  const res = await fetch(
    `${supabaseUrl}/rest/v1/app_internal_secrets?key=in.(R2_ACCESS_KEY_ID,R2_SECRET_ACCESS_KEY)&select=key,value`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!res.ok) throw new Error("Credenciais R2 em falta (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY).");
  const rows = (await res.json()) as { key?: string; value?: string }[];
  const access = rows.find((row) => row.key === "R2_ACCESS_KEY_ID")?.value ?? "";
  const secret = rows.find((row) => row.key === "R2_SECRET_ACCESS_KEY")?.value ?? "";
  return r2ClientWith(access, secret);
}

export function encodeR2Key(key: string): string {
  return key.split("/").map((p) => encodeURIComponent(p)).join("/");
}

export function espelhoKey(bucket: string, objectName: string): string {
  return `espelho/${bucket}/${objectName.replace(/^\/+/, "")}`;
}

export function organizedKey(bucket: string, objectName: string, roleByUser: Record<string, string>): string {
  const name = objectName.replace(/^\/+/, "");
  const uid = name.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  if (!uid) return `organizado/plataforma/${bucket}/${name}`;
  const role = roleByUser[uid] ?? "sem-papel";
  const folder =
    role === "admin_master"
      ? "admin-master"
      : role === "admin_taxi"
        ? "taxi"
        : role === "admin_transfer"
          ? "motorista-executivo"
          : "sem-papel";
  return `organizado/usuarios/${folder}/${uid}/${bucket}/${name}`;
}

export async function r2Put(
  client: AwsClient,
  key: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<void> {
  if (!R2_BUCKET) throw new Error("R2_BUCKET em falta.");
  const url = `${r2Endpoint()}/${R2_BUCKET}/${encodeR2Key(key)}`;
  const res = await client.fetch(url, {
    method: "PUT",
    body,
    headers: { "Content-Type": contentType || "application/octet-stream" },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`R2 PUT ${key} → ${res.status} ${t.slice(0, 240)}`);
  }
}

export async function r2Delete(client: AwsClient, key: string): Promise<void> {
  if (!R2_BUCKET) throw new Error("R2_BUCKET em falta.");
  const url = `${r2Endpoint()}/${R2_BUCKET}/${encodeR2Key(key)}`;
  const res = await client.fetch(url, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    const t = await res.text();
    throw new Error(`R2 DELETE ${key} → ${res.status} ${t.slice(0, 240)}`);
  }
}

/** Lista só as chaves que começam exatamente pelo prefixo pedido. */
export async function r2List(client: AwsClient, prefix: string): Promise<string[]> {
  if (!R2_BUCKET) throw new Error("R2_BUCKET em falta.");
  if (!prefix || prefix.includes("..")) throw new Error("Prefixo R2 inválido.");
  const keys: string[] = [];
  let token = "";
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ "list-type": "2", prefix, "max-keys": "200" });
    if (token) q.set("continuation-token", token);
    const url = `${r2Endpoint()}/${R2_BUCKET}?${q.toString()}`;
    const res = await client.fetch(url, { method: "GET" });
    const text = await res.text();
    if (!res.ok) throw new Error(`R2 LIST ${prefix} → ${res.status} ${text.slice(0, 180)}`);
    const re = /<Key>([^<]*)<\/Key>/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      const key = match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      if (key.startsWith(prefix)) keys.push(key);
    }
    if (!/<IsTruncated>true<\/IsTruncated>/.test(text)) break;
    const next = text.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    if (!next) break;
    token = next[1];
  }
  return keys;
}
