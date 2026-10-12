import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { entradaDoPortalEstaValida } from "@/lib/motoristaPortalEntrada";
import {
  clearDashboardNavSessionStorage,
  isMotoristaFrotaUser,
  setDashboardNavToEntrada,
  userIsMotoristaFrotaFromMetadata,
} from "@/lib/motoristaFrotaRole";

/** Rota após login/MFA. Usa RPC security definer para não depender de RLS em user_roles. */
export async function getPostLoginPath(
  userId: string,
  user?: User | null,
): Promise<"/admin" | "/dashboard" | "/frota"> {
  const ehMotorista =
    userIsMotoristaFrotaFromMetadata(user) || (await isMotoristaFrotaUser(userId, user));
  if (ehMotorista) {
    clearDashboardNavSessionStorage();
    if (await entradaDoPortalEstaValida(userId)) return "/frota";
    return "/login";
  }

  const { data: primary, error } = await supabase.rpc("get_session_primary_role");

  if (!error && primary) {
    if (primary === "admin_master") return "/admin";
    setDashboardNavToEntrada();
    return "/dashboard";
  }

  const { data: rows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = rows?.map((r) => r.role) ?? [];
  if (roles.includes("admin_master")) return "/admin";
  setDashboardNavToEntrada();
  return "/dashboard";
}
