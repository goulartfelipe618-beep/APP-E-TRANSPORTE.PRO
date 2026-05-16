import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  clearDashboardNavSessionStorage,
  isMotoristaFrotaUser,
  userIsMotoristaFrotaFromMetadata,
} from "@/lib/motoristaFrotaRole";

/** Rota após login/MFA. Usa RPC security definer para não depender de RLS em user_roles. */
export async function getPostLoginPath(
  userId: string,
  user?: User | null,
): Promise<"/admin" | "/dashboard" | "/frota"> {
  if (userIsMotoristaFrotaFromMetadata(user)) {
    clearDashboardNavSessionStorage();
    return "/frota";
  }

  const frotaByDb = await isMotoristaFrotaUser(userId, user);
  if (frotaByDb) {
    clearDashboardNavSessionStorage();
    return "/frota";
  }

  const { data: primary, error } = await supabase.rpc("get_session_primary_role");

  if (!error && primary) {
    if (primary === "admin_master") return "/admin";
    return "/dashboard";
  }

  const { data: rows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = rows?.map((r) => r.role) ?? [];
  if (roles.includes("admin_master")) return "/admin";
  return "/dashboard";
}
