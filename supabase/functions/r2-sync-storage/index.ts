/**
 * Copia todos os objectos do Storage Supabase para o R2.
 * Não apaga nada na origem. Só admin_master (Bearer) ou cabeçalho x-r2-sync-secret.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  espelhoKey,
  organizedKey,
  PUBLIC_STORAGE_BUCKETS,
  r2Client,
  r2Put,
} from "../_shared/r2.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-r2-sync-secret",
};

const ALL_BUCKETS = [
  "cadastro-clientes-docs",
  "catalogo-motorista",
  "community-media",
  "fullscreen-banners",
  "login-assets",
  "logos",
  "motorista-frota-docs",
  "templates",
  "veiculos-imagens",
  "website-briefing",
];

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
        if (isFolder) {
          queue.push(path);
        } else {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const syncSecret = Deno.env.get("R2_SYNC_SECRET")?.trim() || Deno.env.get("R2_SECRET_ACCESS_KEY")?.trim() || "";
  const headerSecret = req.headers.get("x-r2-sync-secret")?.trim() ?? "";

  let requested: string[] | null = null;
  try {
    const body = (await req.json()) as { buckets?: unknown };
    if (Array.isArray(body?.buckets)) {
      requested = body.buckets.filter((b): b is string => typeof b === "string");
    }
  } catch {
    requested = null;
  }
  const buckets = requested?.length
    ? ALL_BUCKETS.filter((b) => requested!.includes(b))
    : ALL_BUCKETS;

  const admin = createClient(supabaseUrl, serviceKey);
  let allowed = Boolean(syncSecret && headerSecret && headerSecret === syncSecret);

  if (!allowed) {
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.replace(/^Bearer\s+/i, "").trim();
    if (jwt) {
      const userClient = createClient(supabaseUrl, anon, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data: userData } = await userClient.auth.getUser(jwt);
      const uid = userData.user?.id;
      if (uid) {
        const { data: staff } = await admin.rpc("is_platform_staff", { check_uid: uid });
        allowed = staff === true;
      }
    }
  }

  if (!allowed) return json({ error: "Não autorizado." }, 401);

  const { data: roles } = await admin.from("user_roles").select("user_id, role");
  const roleByUser: Record<string, string> = {};
  for (const row of roles ?? []) {
    roleByUser[String((row as { user_id: string }).user_id)] = String((row as { role: string }).role);
  }

  let r2;
  try {
    r2 = r2Client();
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "R2 não configurado" }, 500);
  }

  const copied: string[] = [];
  const failed: { key: string; error: string }[] = [];

  for (const bucket of buckets) {
    let files: Listed[] = [];
    try {
      files = await listRecursive(admin, bucket);
    } catch (e) {
      failed.push({ key: `${bucket}/`, error: e instanceof Error ? e.message : String(e) });
      continue;
    }
    for (const file of files) {
      const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(file.name);
      if (dlErr || !blob) {
        failed.push({ key: `${bucket}/${file.name}`, error: dlErr?.message ?? "download vazio" });
        continue;
      }
      const buf = await blob.arrayBuffer();
      const mime = blob.type || file.mimetype || "application/octet-stream";
      const k1 = espelhoKey(bucket, file.name);
      const k2 = organizedKey(bucket, file.name, roleByUser);
      try {
        await r2Put(r2, k1, buf, mime);
        if (k2 !== k1) await r2Put(r2, k2, buf, mime);
        copied.push(`${bucket}/${file.name}`);
      } catch (e) {
        failed.push({
          key: `${bucket}/${file.name}`,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return json({
    ok: failed.length === 0,
    copied: copied.length,
    failed: failed.length,
    buckets,
    public_buckets: [...PUBLIC_STORAGE_BUCKETS],
    errors: failed.slice(0, 40),
  });
});
