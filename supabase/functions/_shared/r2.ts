/** Cliente S3 compatível com Cloudflare R2 (aws4fetch). */
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

export const R2_BUCKET = Deno.env.get("R2_BUCKET")?.trim() || "e-transporte";
export const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")?.trim() || "97ffef1ae71def38ec8915c7c530fbd8";

export const PUBLIC_STORAGE_BUCKETS = new Set([
  "catalogo-motorista",
  "community-media",
  "fullscreen-banners",
  "login-assets",
  "logos",
  "templates",
  "veiculos-imagens",
  "website-briefing",
]);

export function r2Endpoint(): string {
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

export function r2Client(): AwsClient {
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")?.trim() ?? "";
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY")?.trim() ?? "";
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Credenciais R2 em falta (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY).");
  }
  return new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });
}

export function encodeR2Key(key: string): string {
  return key
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/");
}

export function espelhoKey(bucket: string, objectName: string): string {
  return `espelho/${bucket}/${objectName.replace(/^\/+/, "")}`;
}

export function organizedKey(
  bucket: string,
  objectName: string,
  roleByUser: Record<string, string>,
): string {
  const name = objectName.replace(/^\/+/, "");
  const platform =
    bucket === "templates" ||
    bucket === "fullscreen-banners" ||
    bucket === "login-assets" ||
    name.startsWith("slides/") ||
    name.startsWith("login/") ||
    name.startsWith("banners/");
  if (platform) {
    return `organizado/plataforma/${bucket}/${name}`;
  }
  const uid = name.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  if (!uid) {
    return `organizado/plataforma/${bucket}/${name}`;
  }
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
  const url = `${r2Endpoint()}/${R2_BUCKET}/${encodeR2Key(key)}`;
  const res = await client.fetch(url, {
    method: "PUT",
    body,
    headers: {
      "Content-Type": contentType || "application/octet-stream",
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`R2 PUT ${key} → ${res.status} ${t.slice(0, 240)}`);
  }
}

export async function r2Get(client: AwsClient, key: string): Promise<Response> {
  const url = `${r2Endpoint()}/${R2_BUCKET}/${encodeR2Key(key)}`;
  return client.fetch(url, { method: "GET" });
}
