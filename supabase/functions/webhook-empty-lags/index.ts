import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { timingSafeEqualUtf8 } from "../_shared/webhook_hmac.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate webhook secret (comparação em tempo constante)
  const secret = req.headers.get("x-webhook-secret") ?? "";
  const expectedSecret = Deno.env.get("WEBHOOK_EMPTY_LEGS_SECRET") ?? "";
  if (!expectedSecret || !timingSafeEqualUtf8(secret, expectedSecret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const dataHora = body.data_hora || null;
    const { error } = await supabase.from("empty_lags").insert({
      origem: body.origem || "",
      destino: body.destino || "",
      data_hora: dataHora,
      data_expiracao: dataHora,
      observacoes: body.observacoes || "",
      status: "pendente",
    });

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Invalid payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
