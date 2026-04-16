import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAID = ["pro"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const raw = String(body.plano || "").toLowerCase().trim();
    if (!PAID.includes(raw as (typeof PAID)[number])) {
      return new Response(JSON.stringify({ error: "Plano inválido. Utilize pro (plano PRÓ)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const plano = raw as (typeof PAID)[number];

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const roleList = (roles || []).map((r: { role: string }) => r.role);
    if (roleList.includes("admin_master")) {
      return new Response(JSON.stringify({ error: "Conta administrativa não utiliza este fluxo." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!roleList.includes("admin_transfer") && !roleList.includes("admin_taxi")) {
      return new Response(JSON.stringify({ error: "Apenas motoristas e taxistas podem alterar o plano por aqui." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: planRow } = await supabaseAdmin
      .from("user_plans")
      .select("plano")
      .eq("user_id", user.id)
      .maybeSingle();

    if (planRow?.plano !== "free") {
      return new Response(
        JSON.stringify({
          error: "Alteração automática disponível apenas para o plano FREE. Use o suporte para outros casos.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: upErr } = await supabaseAdmin.from("user_plans").upsert(
      { user_id: user.id, plano, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin.from("solicitacoes_motoristas").delete().eq("lead_user_id", user.id);

    return new Response(JSON.stringify({ success: true, plano }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
