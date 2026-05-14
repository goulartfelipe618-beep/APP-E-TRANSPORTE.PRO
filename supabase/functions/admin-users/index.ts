import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Alinhado a `validatePainelStrongPassword` no cliente / motorista-frota-portal. */
function validateStrongPassword(password: string): string | null {
  const p = String(password);
  if (p.length < 12) return "A senha deve ter pelo menos 12 caracteres.";
  if (p.length > 128) return "Senha demasiado longa.";
  if (!/[a-z]/.test(p)) return "Inclua pelo menos uma letra minúscula.";
  if (!/[A-Z]/.test(p)) return "Inclua pelo menos uma letra maiúscula.";
  if (!/[0-9]/.test(p)) return "Inclua pelo menos um número.";
  if (!/[^A-Za-z0-9]/.test(p)) return "Inclua pelo menos um símbolo (ex.: ! @ # ?).";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller } } = await supabaseUser.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin_master")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), { status: 403, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // LIST USERS (inclui admin_master para aparecer no painel Cadastrados)
    if (req.method === "GET" && action === "list") {
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role");

      if (!roles || roles.length === 0) {
        return new Response(JSON.stringify([]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Paginar até trazer todos (listUsers retorna por página; sem isso parte some da lista)
      const authUsers: any[] = [];
      let page = 1;
      const perPage = 1000;
      while (true) {
        const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        });
        if (listErr) {
          return new Response(
            JSON.stringify({ error: listErr.message || "Erro ao listar usuários Auth" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const batch = listData?.users || [];
        authUsers.push(...batch);
        if (batch.length < perPage) break;
        page += 1;
      }

      // Fetch plans (admin_master não usa plano de assinatura)
      const userIds = roles.map((r: any) => r.user_id);
      const { data: plans } = await supabaseAdmin
        .from("user_plans")
        .select("user_id, plano, billing_manual_override")
        .in("user_id", userIds);

      const roleMap = new Map(roles.map((r: any) => [r.user_id, r.role]));
      const planMap = new Map(
        (plans || []).map((p: any) => [
          p.user_id,
          { plano: p.plano, billing_manual_override: p.billing_manual_override === true },
        ]),
      );

      const users = authUsers
        .filter((u: any) => roleMap.has(u.id))
        .map((u: any) => {
          const role = roleMap.get(u.id) || "sem_role";
          const planEntry = planMap.get(u.id) as { plano: string; billing_manual_override: boolean } | undefined;
          const plano =
            role === "admin_master" ? "n/a" : (planEntry?.plano || "free");
          const plano_bloqueado_mp =
            role === "admin_master" ? false : Boolean(planEntry?.billing_manual_override);
          return {
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            role,
            plano,
            plano_bloqueado_mp,
          };
        });

      return new Response(JSON.stringify(users), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // CREATE USER (apenas admin_master — verificado acima)
    if (req.method === "POST" && action === "create") {
      const body = await req.json();
      const { email, password, role, plano } = body;

      if (!email || !password || !role) {
        return new Response(JSON.stringify({ error: "Email, senha e função são obrigatórios" }), { status: 400, headers: corsHeaders });
      }

      const emailNorm = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
        return new Response(JSON.stringify({ error: "E-mail inválido" }), { status: 400, headers: corsHeaders });
      }

      const pwErr = validateStrongPassword(String(password));
      if (pwErr) {
        return new Response(JSON.stringify({ error: pwErr }), { status: 400, headers: corsHeaders });
      }

      if (!["admin_transfer", "admin_master"].includes(role)) {
        return new Response(JSON.stringify({ error: "Função inválida" }), { status: 400, headers: corsHeaders });
      }

      // Blindagem: só permite criar admin_master se ainda não existe nenhum (limite duro de 1).
      if (role === "admin_master") {
        const { data: existingMaster } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin_master")
          .limit(1)
          .maybeSingle();
        if (existingMaster) {
          return new Response(
            JSON.stringify({
              error: "Já existe uma conta admin_master ativa. Esta plataforma só permite UM administrador master.",
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: emailNorm,
        password,
        email_confirm: true,
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: corsHeaders });
      }

      const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
        user_id: newUser.user.id,
        role,
      });

      if (roleError) {
        return new Response(JSON.stringify({ error: roleError.message }), { status: 400, headers: corsHeaders });
      }

      // Create plan record (only for non-admin_master)
      if (role !== "admin_master") {
        const validPlans = ["free", "standart", "pro"] as const;
        const rawPlano = String(plano ?? "").toLowerCase().trim();
        const norm = rawPlano === "standard" ? "standart" : rawPlano;
        const userPlano = (validPlans as readonly string[]).includes(norm)
          ? norm
          : "free";
        await supabaseAdmin.from("user_plans").insert({
          user_id: newUser.user.id,
          plano: userPlano,
          billing_manual_override: userPlano !== "free",
        });
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // UPDATE PLAN: FREE ↔ PRÓ (apenas contas com plano — não admin_master)
    if (req.method === "POST" && action === "update_plan") {
      const body = await req.json();
      const { user_id, plano, allow_mp_billing } = body as {
        user_id?: string;
        plano?: unknown;
        allow_mp_billing?: unknown;
      };

      if (!user_id || plano === undefined || plano === null || String(plano).trim() === "") {
        return new Response(JSON.stringify({ error: "user_id e plano são obrigatórios" }), { status: 400, headers: corsHeaders });
      }

      const allowMercadoPago =
        allow_mp_billing === true ||
        allow_mp_billing === "true" ||
        allow_mp_billing === 1 ||
        allow_mp_billing === "1";

      const rawPlano = String(plano).toLowerCase().trim();
      const planoNorm = rawPlano === "standard" ? "standart" : rawPlano;
      if (!["free", "standart", "pro"].includes(planoNorm)) {
        return new Response(JSON.stringify({ error: "Plano inválido. Use free, standart ou pro." }), { status: 400, headers: corsHeaders });
      }

      const { data: targetRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user_id);

      const roles = (targetRoles || []).map((r: { role: string }) => r.role);
      if (roles.includes("admin_master")) {
        return new Response(
          JSON.stringify({ error: "Não é possível definir plano de assinatura para a conta de administrador master." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (roles.length === 0) {
        return new Response(JSON.stringify({ error: "Utilizador sem função registada." }), { status: 400, headers: corsHeaders });
      }

      // Upsert plan (persistir sempre standart, nunca o alias "standard").
      // admin_master: allow_mp_billing=true → Mercado Pago volta a sincronizar; caso contrário bloqueia webhooks.
      const { error } = await supabaseAdmin.from("user_plans").upsert(
        {
          user_id,
          plano: planoNorm,
          updated_at: new Date().toISOString(),
          billing_manual_override: !allowMercadoPago,
        },
        { onConflict: "user_id" },
      );

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Finalizar lead da Landing Page: garante role/plano/login, remove só a solicitação (usuário permanece em Cadastrados).
    if (req.method === "POST" && action === "finalize_landing_lead") {
      const body = await req.json();
      const { solicitacao_id, plano: bodyPlano } = body as { solicitacao_id?: string; plano?: string };

      if (!solicitacao_id) {
        return new Response(JSON.stringify({ error: "solicitacao_id é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const paidPlans = ["standart", "pro"] as const;
      const planoRaw = String(bodyPlano || "").toLowerCase().trim();
      const planoFinal = planoRaw === "standard" ? "standart" : planoRaw;
      if (!paidPlans.includes(planoFinal as (typeof paidPlans)[number])) {
        return new Response(
          JSON.stringify({ error: "plano é obrigatório: standart (STANDART) ou pro (PRÓ)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: row, error: rowErr } = await supabaseAdmin
        .from("solicitacoes_motoristas")
        .select("id, lead_user_id")
        .eq("id", solicitacao_id)
        .maybeSingle();

      if (rowErr) {
        return new Response(JSON.stringify({ error: rowErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!row) {
        return new Response(JSON.stringify({ error: "Solicitação não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const leadUserId = row.lead_user_id as string | null;
      if (leadUserId) {
        const { data: leadRoles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", leadUserId);
        const r = (leadRoles || []).map((x: { role: string }) => x.role);
        if (r.includes("admin_master")) {
          return new Response(
            JSON.stringify({
              error:
                "Este lead aponta para uma conta de administrador. Exclua o registro ou corrija o e-mail no formulário.",
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const { error: roleErr } = await supabaseAdmin.rpc("replace_user_role", {
          _user_id: leadUserId,
          _role: "admin_transfer",
        });
        if (roleErr) {
          return new Response(JSON.stringify({ error: roleErr.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: planErr } = await supabaseAdmin.from("user_plans").upsert(
          {
            user_id: leadUserId,
            plano: planoFinal,
            updated_at: new Date().toISOString(),
            billing_manual_override: true,
          },
          { onConflict: "user_id" },
        );
        if (planErr) {
          return new Response(JSON.stringify({ error: planErr.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: unbanErr } = await supabaseAdmin.auth.admin.updateUserById(leadUserId, {
          ban_duration: "none",
        });
        if (unbanErr) {
          return new Response(JSON.stringify({ error: unbanErr.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { error: delErr } = await supabaseAdmin
        .from("solicitacoes_motoristas")
        .delete()
        .eq("id", solicitacao_id);

      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE USER — descontinuado no painel; usar o dashboard Supabase para remover contas.
    if (req.method === "POST" && action === "delete") {
      return new Response(
        JSON.stringify({
          error:
            "A exclusão de utilizadores pelo painel foi descontinuada. Utilize o Supabase Dashboard (Auth e dados associados).",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // DISABLE USER (ban at Auth level)
    // Used pelo admin (Solicitações → Cadastro pelo site) para desativar o login do lead.
    if (req.method === "POST" && action === "disable_user") {
      const body = await req.json();
      const { user_id, ban_duration } = body;

      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id é obrigatório" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Default: ban for ~100 years (practically "disabled until manual action").
      const ban = ban_duration || "876000h";

      // Update auth user
      const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        ban_duration: ban,
      });

      if (banErr) {
        return new Response(JSON.stringify({ error: banErr.message }), { status: 400, headers: corsHeaders });
      }

      // Update request row status when this user is stored as the lead.
      await supabaseAdmin
        .from("solicitacoes_motoristas")
        .update({ status: "desativado", updated_at: new Date().toISOString() })
        .eq("lead_user_id", user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação não encontrada" }), { status: 404, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
