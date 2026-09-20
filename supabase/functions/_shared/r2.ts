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

export async function r2Head(client: AwsClient, key: string): Promise<boolean> {
  const url = `${r2Endpoint()}/${R2_BUCKET}/${encodeR2Key(key)}`;
  const res = await client.fetch(url, { method: "HEAD" });
  return res.ok;
}

/** URL GET assinada: o browser baixa o objecto no R2, sem o body passar pelo Supabase. */
export async function r2PresignGet(client: AwsClient, key: string, expiresSeconds = 3600): Promise<string> {
  const expires = Math.min(Math.max(expiresSeconds, 60), 7 * 24 * 3600);
  const url = `${r2Endpoint()}/${R2_BUCKET}/${encodeR2Key(key)}?X-Amz-Expires=${expires}`;
  const signed = await client.sign(url, { method: "GET", aws: { signQuery: true } });
  return signed.url;
}

export function r2PublicCdnBase(): string {
  return (Deno.env.get("R2_PUBLIC_BASE_URL") ?? "").trim().replace(/\/+$/, "");
}

export function publicObjectUrl(key: string, supabaseUrl: string): string {
  const rest = key.replace(/^\/+/, "");
  const cdn = r2PublicCdnBase();
  if (cdn) return `${cdn}/${rest.split("/").map(encodeURIComponent).join("/")}`;
  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/r2-media/${rest}`;
}

export function rewritePublicStorageUrl(raw: string, supabaseUrl: string): string {
  const t = raw.trim();
  const marker = "/storage/v1/object/public/";
  const i = t.indexOf(marker);
  if (i < 0) return t;
  const rest = t.slice(i + marker.length);
  return publicObjectUrl(`espelho/${rest}`, supabaseUrl);
}

export const PRIVATE_STORAGE_BUCKETS = new Set(["cadastro-clientes-docs", "motorista-frota-docs"]);
