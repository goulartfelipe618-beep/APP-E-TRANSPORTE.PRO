import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // LIST USERS - optimized: fetch roles then batch auth users
    if (req.method === "GET" && action === "list") {
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role")
        .neq("role", "admin_master");

      if (!roles || roles.length === 0) {
        return new Response(JSON.stringify([]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fetch all auth users in one call instead of N calls
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const authUsers = listData?.users || [];

      const roleMap = new Map(roles.map((r: any) => [r.user_id, r.role]));
      const users = authUsers
        .filter((u: any) => roleMap.has(u.id))
        .map((u: any) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          role: roleMap.get(u.id) || "sem_role",
        }));

      return new Response(JSON.stringify(users), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // CREATE USER
    if (req.method === "POST" && action === "create") {
      const body = await req.json();
      const { email, password, role } = body;

      if (!email || !password || !role) {
        return new Response(JSON.stringify({ error: "Email, senha e função são obrigatórios" }), { status: 400, headers: corsHeaders });
      }

      if (!["admin_transfer", "admin_taxi"].includes(role)) {
        return new Response(JSON.stringify({ error: "Função inválida" }), { status: 400, headers: corsHeaders });
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
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

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // DELETE USER - cascade delete all user data then hard-delete auth user
    if (req.method === "POST" && action === "delete") {
      const body = await req.json();
      const { user_id } = body;

      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id é obrigatório" }), { status: 400, headers: corsHeaders });
      }

      // Prevent deleting admin_master
      const { data: targetRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user_id)
        .eq("role", "admin_master")
        .maybeSingle();

      if (targetRole) {
        return new Response(JSON.stringify({ error: "Não é possível excluir um admin master" }), { status: 403, headers: corsHeaders });
      }

      // Delete ALL user data from every table that has user_id
      const tablesToClean = [
        "anotacoes",
        "automacoes",
        "cabecalho_contratual",
        "chamadas_taxi",
        "configuracoes",
        "contratos",
        "network",
        "reservas_grupos",
        "reservas_transfer",
        "solicitacoes_grupos",
        "solicitacoes_motoristas",
        "solicitacoes_servicos",
        "solicitacoes_transfer",
        "webhook_testes",
      ];

      // Delete all user data in parallel
      await Promise.all(
        tablesToClean.map((table) =>
          supabaseAdmin.from(table).delete().eq("user_id", user_id)
        )
      );

      // Delete role
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);

      // Hard-delete auth user (not soft delete) so email can be reused
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), { status: 400, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ação não encontrada" }), { status: 404, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
