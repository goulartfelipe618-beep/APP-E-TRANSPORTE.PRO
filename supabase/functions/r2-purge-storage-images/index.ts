/**
 * Apaga imagens no Storage Supabase só se o objecto já existir no R2 (HEAD).
 * PDFs e ficheiros sem correspondência no R2 não são removidos.
 * Auth: x-r2-sync-secret ou admin_master.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { espelhoKey, r2Client, r2Head } from "../_shared/r2.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-r2-sync-secret",
};

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|bmp|ico|avif)$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Listed = { name: string; mimetype?: string };

async function listRecursive(admin: SupabaseClient, bucket: string): Promise<Listed[]> {
  const out: Listed[] = [];
  const queue = [""];
  const seen = new Set<string>();
  while (queue.length) {
    const folder = queue.shift() ?? "";
    let offset = 0;
    for (;;) {
      const { data, error } = await admin.storage.from(bucket).list(folder || undefined, {
        limit: 1000,
        offset,
      });
      if (error) throw new Error(`${bucket}: ${error.message}`);
      if (!data?.length) break;
      for (const item of data) {
        const path = folder ? `${folder}/${item.name}` : item.name;
        if (seen.has(path)) continue;
        seen.add(path);
        const isFolder = item.id == null;
        if (isFolder) queue.push(path);
        else {
          out.push({
            name: path,
            mimetype: typeof item.metadata?.mimetype === "string" ? item.metadata.mimetype : undefined,
          });
        }
      }
      if (data.length < 1000) break;
      offset += data.length;
    }
  }
  return out;
}

function isImage(item: Listed): boolean {
  const mime = (item.mimetype || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  if (mime === "application/pdf") return false;
  return IMAGE_EXT.test(item.name);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const syncSecret = (Deno.env.get("R2_SYNC_SECRET") || Deno.env.get("R2_SECRET_ACCESS_KEY") || "").trim();
  const headerSecret = (req.headers.get("x-r2-sync-secret") ?? "").trim();

  const admin = createClient(supabaseUrl, serviceKey);
  let authorized = syncSecret.length >= 16 && headerSecret.length === syncSecret.length && headerSecret === syncSecret;
  if (!authorized) {
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "Não autorizado." }, 401);
    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData } = await userClient.auth.getUser(jwt);
    const uid = userData.user?.id;
    if (!uid) return json({ error: "Não autorizado." }, 401);
    const { data: master } = await admin.rpc("is_admin_master", { _user_id: uid });
    authorized = master === true;
  }
  if (!authorized) return json({ error: "Não autorizado." }, 401);

  let buckets: string[] | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body?.buckets)) buckets = body.buckets.map(String);
  } catch {
    buckets = undefined;
  }

  const { data: bucketRows } = await admin.storage.listBuckets();
  const allBuckets = (bucketRows ?? []).map((b) => b.name);
  const target = (buckets?.length ? buckets : allBuckets).filter((b) => allBuckets.includes(b));

  let r2;
  try {
    r2 = r2Client();
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "R2 não configurado" }, 500);
  }

  const deleted: { bucket: string; path: string }[] = [];
  const skippedMissingR2: { bucket: string; path: string }[] = [];
  const skippedNonImage: { bucket: string; path: string }[] = [];
  const errors: { bucket: string; path: string; error: string }[] = [];

  for (const bucket of target) {
    const listed = await listRecursive(admin, bucket);
    for (const item of listed) {
      if (!isImage(item)) {
        skippedNonImage.push({ bucket, path: item.name });
        continue;
      }
      const exists = await r2Head(r2, espelhoKey(bucket, item.name));
      if (!exists) {
        skippedMissingR2.push({ bucket, path: item.name });
        continue;
      }
      const { error } = await admin.storage.from(bucket).remove([item.name]);
      if (error) errors.push({ bucket, path: item.name, error: error.message });
      else deleted.push({ bucket, path: item.name });
    }
  }

  return json({
    ok: errors.length === 0,
    deleted: deleted.length,
    skippedMissingR2: skippedMissingR2.length,
    skippedNonImage: skippedNonImage.length,
    errors,
    sampleDeleted: deleted.slice(0, 20),
  });
});
