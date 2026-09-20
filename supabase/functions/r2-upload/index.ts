/**
 * Upload autenticado para o R2 (espelho + organizado). Não remove o ficheiro no Supabase.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { espelhoKey, organizedKey, r2Client, r2Put } from "../_shared/r2.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "Sessão inválida." }, 401);

  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  const uid = userData.user?.id;
  if (userErr || !uid) return json({ error: "Sessão inválida." }, 401);

  const form = await req.formData();
  const bucket = String(form.get("bucket") ?? "").trim();
  const path = String(form.get("path") ?? "").replace(/^\/+/, "").trim();
  const file = form.get("file");
  if (!bucket || !path || !(file instanceof File)) {
    return json({ error: "bucket, path e file são obrigatórios." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: staff } = await admin.rpc("is_platform_staff", { check_uid: uid });
  const ownerPrefix = `${uid}/`;
  if (staff !== true && !path.startsWith(ownerPrefix) && !path.startsWith("slides/") && !path.startsWith("login/") && !path.startsWith("banners/") && !path.startsWith("templates/")) {
    return json({ error: "Sem permissão para este caminho." }, 403);
  }

  const { data: roleRow } = await admin.from("user_roles").select("user_id, role");
  const roleByUser: Record<string, string> = {};
  for (const row of roleRow ?? []) {
    roleByUser[String((row as { user_id: string }).user_id)] = String((row as { role: string }).role);
  }

  let r2;
  try {
    r2 = r2Client();
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "R2 não configurado" }, 500);
  }

  const buf = await file.arrayBuffer();
  const mime = file.type || "application/octet-stream";
  const k1 = espelhoKey(bucket, path);
  const k2 = organizedKey(bucket, path, roleByUser);
  await r2Put(r2, k1, buf, mime);
  if (k2 !== k1) await r2Put(r2, k2, buf, mime);

  return json({ ok: true, espelho: k1, organizado: k2 });
});
