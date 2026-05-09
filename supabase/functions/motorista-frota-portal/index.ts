import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

function normalizePlanoForEdge(raw: string | null | undefined): "free" | "standart" | "pro" {
  if (!raw) return "free";
  const p = String(raw).toLowerCase().trim();
  if (p === "free") return "free";
  if (p === "standart" || p === "standard") return "standart";
  if (p === "pro" || ["seed", "grow", "rise", "apex", "premium"].includes(p)) return "pro";
  return "free";
}

async function assertFrotaOwnerProPlan(
  supabaseAdmin: ReturnType<typeof createClient>,
  ownerUserId: string,
): Promise<Response | null> {
  const { data: planRow } = await supabaseAdmin
    .from("user_plans")
    .select("plano")
    .eq("user_id", ownerUserId)
    .maybeSingle();
  const tier = normalizePlanoForEdge(planRow?.plano as string | undefined);
  if (tier !== "pro") {
    return new Response(
      JSON.stringify({
        error: "portal_pro_only",
        message:
          "O mini painel do motorista só está disponível com o plano PRÓ ativo na conta da frota. Contacte o administrador.",
      }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
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
      const json = (await req.json()) as {
        action?: string;
        token?: string;
        password?: string;
        motorista_id?: string;
      };
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
          .select("id, nome, portal_auth_user_id, portal_login_email, status, user_id")
          .eq("portal_token", token)
          .eq("status", "cadastrado")
          .maybeSingle();

        if (error || !row) {
          return new Response(JSON.stringify({ error: "Link inválido ou cadastro indisponível." }), {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const blocked = await assertFrotaOwnerProPlan(supabaseAdmin, row.user_id as string);
        if (blocked) return blocked;

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
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const blockedBoot = await assertFrotaOwnerProPlan(supabaseAdmin, row.user_id as string);
        if (blockedBoot) return blockedBoot;

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

      if (action === "reset_portal_password") {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.trim()) {
          return new Response(JSON.stringify({ error: "Sessão obrigatória." }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: authErr } = await userClient.auth.getUser();
        if (authErr || !user) {
          return new Response(JSON.stringify({ error: "Sessão inválida." }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const motoristaId = String(json.motorista_id ?? "").trim();
        const password = json.password ?? "";
        if (!motoristaId) {
          return new Response(JSON.stringify({ error: "motorista_id obrigatório." }), {
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
          .select("id, user_id, portal_auth_user_id, status")
          .eq("id", motoristaId)
          .eq("status", "cadastrado")
          .maybeSingle();

        if (qErr || !row) {
          return new Response(JSON.stringify({ error: "Cadastro não encontrado." }), {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (row.user_id !== user.id) {
          return new Response(JSON.stringify({ error: "Sem permissão para redefinir este motorista." }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!row.portal_auth_user_id) {
          return new Response(
            JSON.stringify({
              error:
                "O motorista ainda não definiu a senha pelo link do portal. Partilhe o link «Copiar link» para a primeira configuração.",
            }),
            {
              status: 422,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(row.portal_auth_user_id, {
          password,
        });

        if (updErr) {
          return new Response(JSON.stringify({ error: updErr.message ?? "Erro ao atualizar senha." }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({ ok: true, message: "Senha do portal do motorista atualizada." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(JSON.stringify({ error: "Use POST com action: status | bootstrap | reset_portal_password" }), {
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
