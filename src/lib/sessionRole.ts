import { supabase } from "@/integrations/supabase/client";

/** Rota após login/MFA. Usa RPC security definer para não depender de RLS em user_roles. */
export async function getPostLoginPath(userId: string): Promise<"/admin" | "/taxi" | "/dashboard"> {
  const { data: primary, error } = await supabase.rpc("get_session_primary_role");

  if (!error && primary) {
    if (primary === "admin_master") return "/admin";
    if (primary === "admin_taxi") return "/taxi";
    return "/dashboard";
  }

  const { data: rows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = rows?.map((r) => r.role) ?? [];
  if (roles.includes("admin_master")) return "/admin";
  if (roles.includes("admin_taxi")) return "/taxi";
  return "/dashboard";
}
