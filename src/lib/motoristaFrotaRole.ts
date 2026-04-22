import { supabase } from "@/integrations/supabase/client";

/** Utilizador é motorista da frota (submotorista com portal activado). */
export async function isMotoristaFrotaUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("solicitacoes_motoristas")
    .select("id")
    .eq("portal_auth_user_id", userId)
    .maybeSingle();
  if (error) return false;
  return data != null;
}
