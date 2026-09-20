/**
 * Cópia Storage Supabase → Cloudflare R2 (espelho + organizado).
 * Não apaga origem. Credenciais via .env (R2_*).
 */
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(path) {
  const out = {};
  let raw = "";
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = { ...loadEnv(resolve(".env")), ...process.env };
const ACCESS = env.R2_ACCESS_KEY_ID;
const SECRET = env.R2_SECRET_ACCESS_KEY;
const ACCOUNT = env.R2_ACCOUNT_ID || "97ffef1ae71def38ec8915c7c530fbd8";
const BUCKET = env.R2_BUCKET || "e-transporte";
const SUPABASE_URL = (env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");

if (!ACCESS || !SECRET) {
  console.error("Faltam R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY no .env");
  process.exit(1);
}

const ROLE_BY_USER = {
  "9fffb6bd-9a48-415e-8ab1-b97572248b20": "admin_master",
  "039b4841-0ecc-4a17-af76-d77de6a08e83": "admin_transfer",
  "0c210219-5970-44ff-84ce-69e201769c3d": "admin_transfer",
  "4c334f97-3577-4af5-8dff-49e2eb5cef18": "admin_transfer",
  "5b34323a-f469-44d3-b887-92fbcf9a9fbf": "admin_transfer",
  "63689b5c-6d19-45d9-a7ca-889d43254494": "admin_transfer",
  "8851d306-5884-4d8f-bec5-1da9b2785f0a": "admin_transfer",
  "b9159ec4-8d2d-498a-b3dd-5e16a892cd60": "admin_transfer",
  "c16e7406-0984-4b6d-bacc-c741229ff5e8": "admin_transfer",
  "d1d09dc2-e19d-4a9f-a58e-dad4e4a045a6": "admin_transfer",
  "d5ffb8ba-455e-4948-a022-ac273b26d906": "admin_transfer",
  "f2c75b56-b2ca-4eac-976c-e1be13af78ef": "admin_transfer",
  "f4b2e4e9-871d-42be-b858-cd7ba1a10a4f": "admin_transfer",
};

const PRIVATE_BUCKETS = new Set(["cadastro-clientes-docs", "motorista-frota-docs"]);

function espelhoKey(bucket, objectName) {
  return `espelho/${bucket}/${objectName.replace(/^\/+/, "")}`;
}

function organizedKey(bucket, objectName) {
  const name = objectName.replace(/^\/+/, "");
  const platform =
    bucket === "templates" ||
    bucket === "fullscreen-banners" ||
    bucket === "login-assets" ||
    name.startsWith("slides/") ||
    name.startsWith("login/") ||
    name.startsWith("banners/");
  if (platform) return `organizado/plataforma/${bucket}/${name}`;
  const uid = name.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  if (!uid) return `organizado/plataforma/${bucket}/${name}`;
  const role = ROLE_BY_USER[uid] ?? "sem-papel";
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

function hmac(key, data) {
  return createHmac("sha256", key).update(data).digest();
}

function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

async function r2Put(key, body, contentType) {
  const host = `${ACCOUNT}.r2.cloudflarestorage.com`;
  const region = "auto";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const canonicalUri = `/${BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${SECRET}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${ACCESS}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const res = await fetch(`https://${host}${canonicalUri}`, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`R2 PUT ${key} → ${res.status} ${t.slice(0, 240)}`);
  }
}

async function r2Head(key) {
  const host = `${ACCOUNT}.r2.cloudflarestorage.com`;
  const region = "auto";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex("");
  const canonicalUri = `/${BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["HEAD", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${SECRET}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${ACCESS}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const res = await fetch(`https://${host}${canonicalUri}`, {
    method: "HEAD",
    headers: {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
  });
  return res.ok;
}

const OBJECTS = JSON.parse(readFileSync(new URL("./r2-storage-inventory.json", import.meta.url), "utf8"));

async function downloadPublic(bucket, name) {
  const url = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${name.split("/").map(encodeURIComponent).join("/")}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${bucket}/${name} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function downloadPrivate(bucket, name) {
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!service) throw new Error("privado: falta SUPABASE_SERVICE_ROLE_KEY");
  const url = `${SUPABASE_URL}/storage/v1/object/authenticated/${bucket}/${name.split("/").map(encodeURIComponent).join("/")}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${service}`, apikey: service } });
  if (!res.ok) throw new Error(`download auth ${bucket}/${name} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const copied = [];
const failed = [];
const skippedPrivate = [];

for (const item of OBJECTS) {
  const { bucket_id: bucket, name, mime } = item;
  const contentType = mime || "application/octet-stream";
  try {
    const buf = PRIVATE_BUCKETS.has(bucket)
      ? await downloadPrivate(bucket, name)
      : await downloadPublic(bucket, name);
    const k1 = espelhoKey(bucket, name);
    const k2 = organizedKey(bucket, name);
    await r2Put(k1, buf, contentType);
    if (k2 !== k1) await r2Put(k2, buf, contentType);
    copied.push(`${bucket}/${name}`);
    process.stdout.write(`ok ${copied.length}/${OBJECTS.length} ${bucket}/${name}\n`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (PRIVATE_BUCKETS.has(bucket) && msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      skippedPrivate.push(`${bucket}/${name}`);
    } else {
      failed.push({ key: `${bucket}/${name}`, error: msg });
      process.stderr.write(`fail ${bucket}/${name} ${msg}\n`);
    }
  }
}

let verify = 0;
for (const item of OBJECTS) {
  if (skippedPrivate.includes(`${item.bucket_id}/${item.name}`)) continue;
  const ok = await r2Head(espelhoKey(item.bucket_id, item.name));
  if (ok) verify += 1;
}

console.log(
  JSON.stringify(
    {
      ok: failed.length === 0 && skippedPrivate.length === 0,
      copied: copied.length,
      failed: failed.length,
      skipped_private: skippedPrivate.length,
      verified_espelho: verify,
      errors: failed.slice(0, 20),
    },
    null,
    2,
  ),
);
if (failed.length) process.exit(1);
