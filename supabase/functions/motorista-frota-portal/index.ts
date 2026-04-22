import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Alinhado ao painel: senhas fortes para contas Auth dos submotoristas. */
function validatePortalPassword(password: string): string | null {
  if (password.length < 12) {
    return "A senha deve ter pelo menos 12 caracteres.";
  }
  if (password.length > 128) {
    return "Senha demasiado longa.";
  }
  if (!/[a-z]/.test(password)) {
    return "Inclua pelo menos uma letra minúscula.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Inclua pelo menos uma letra maiúscula.";
  }
  if (!/[0-9]/.test(password)) {
    return "Inclua pelo menos um número.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Inclua pelo menos um símbolo (ex.: ! @ # ?).";
  }
  return null;
}

type BodyBootstrap = {
  token: string;
  password: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (req.method === "POST") {
      const json = (await req.json()) as { action?: string; token?: string; password?: string };
      const action = json.action ?? url.searchParams.get("action") ?? "status";

      if (action === "status") {
        const token = (json.token ?? "").trim();
        if (!token) {
          return new Response(JSON.stringify({ error: "token obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: row, error } = await supabaseAdmin
          .from("solicitacoes_motoristas")
          .select("id, nome, portal_auth_user_id, portal_login_email, status")
          .eq("portal_token", token)
          .eq("status", "cadastrado")
          .maybeSingle();

        if (error || !row) {
          return new Response(JSON.stringify({ error: "Link inválido ou cadastro indisponível." }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const syntheticEmail = `frota.${String(row.id).replace(/-/g, "")}@motorista-frota.local`;
        const loginEmailResolved =
          row.portal_auth_user_id != null
            ? (row.portal_login_email?.trim() || syntheticEmail)
            : null;

        return new Response(
          JSON.stringify({
            nome: row.nome,
            registered: row.portal_auth_user_id != null,
            login_email: loginEmailResolved,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (action === "bootstrap") {
        const body = json as BodyBootstrap;
        const token = (body.token ?? "").trim();
        const password = body.password ?? "";
        if (!token) {
          return new Response(JSON.stringify({ error: "Token obrigatório." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const pwErr = validatePortalPassword(password);
        if (pwErr) {
          return new Response(JSON.stringify({ error: pwErr }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: row, error: qErr } = await supabaseAdmin
          .from("solicitacoes_motoristas")
          .select("id, user_id, nome, portal_auth_user_id, status")
          .eq("portal_token", token)
          .eq("status", "cadastrado")
          .maybeSingle();

        if (qErr || !row) {
          return new Response(JSON.stringify({ error: "Link inválido." }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (row.portal_auth_user_id) {
          return new Response(JSON.stringify({ error: "Este cadastro já tem senha definida. Use o login." }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const email = `frota.${String(row.id).replace(/-/g, "")}@motorista-frota.local`;

        const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            app_role: "motorista_frota",
            solicitacao_motorista_id: row.id,
            owner_user_id: row.user_id,
          },
        });

        if (cErr || !created.user) {
          return new Response(JSON.stringify({ error: cErr?.message ?? "Erro ao criar utilizador." }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: uErr } = await supabaseAdmin
          .from("solicitacoes_motoristas")
          .update({
            portal_auth_user_id: created.user.id,
            portal_login_email: email,
          })
          .eq("id", row.id);

        if (uErr) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(created.user.id);
          } catch {
            /* ignore */
          }
          return new Response(JSON.stringify({ error: uErr.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            email,
            message: "Conta criada. Pode iniciar sessão.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(JSON.stringify({ error: "Use POST com action: status | bootstrap" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
