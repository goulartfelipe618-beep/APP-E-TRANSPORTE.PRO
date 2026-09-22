import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

export const R2_BUCKET = Deno.env.get("R2_BUCKET")?.trim() || "e-transporte";
export const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")?.trim() || "97ffef1ae71def38ec8915c7c530fbd8";

export function r2Endpoint(): string {
  if (!R2_ACCOUNT_ID) throw new Error("R2_ACCOUNT_ID em falta.");
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

export function r2Client(): AwsClient {
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")?.trim() || "";
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY")?.trim() || "";
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
  return key.split("/").map((p) => encodeURIComponent(p)).join("/");
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
