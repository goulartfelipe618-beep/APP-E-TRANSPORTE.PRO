import type { Session, SupabaseClient } from "@supabase/supabase-js";

/** Nível AAL presente no JWT emitido pelo GoTrue (após verificação TOTP fica `aal2`). */
export function jwtAuthenticatorAssuranceLevel(accessToken: string): "aal1" | "aal2" | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const json = atob(b64 + pad);
    const payload = JSON.parse(json) as { aal?: string };
    if (payload.aal === "aal2") return "aal2";
    if (payload.aal === "aal1") return "aal1";
    return null;
  } catch {
    return null;
  }
}

async function hasVerifiedTotpFactor(supabase: SupabaseClient): Promise<boolean> {
  for (let attempt = 0; attempt <= 2; attempt++) {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error) {
      return (data?.totp ?? []).some((f) => f.status === "verified");
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
  }
  return false;
}

/**
 * Indica se a sessão atual precisa completar o desafio TOTP antes de aceder ao painel.
 * Cada utilizador tem os seus próprios fatores em `auth.mfa_factors` (ligados ao `user_id` da sessão).
 *
 * `sessionHint`: usar **sempre** após `signInWithPassword` / evento com a sessão nova — `getSession()` pode
 * devolver momentaneamente o token antigo (ex.: ainda `aal2`), saltando o 2FA indevidamente.
 *
 * Regra: nunca contornar 2FA quando existir fator TOTP verificado e o JWT ainda não estiver em `aal2`.
 */
export async function sessionRequiresMfaTotpChallenge(
  supabase: SupabaseClient,
  sessionHint?: Session | null,
): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  /** Preferir sessão explícita (evita token antigo na mesma aba após novo login). */
  const session = sessionHint ?? sessionData.session;
  if (!session?.access_token) return false;

  let accessToken = session.access_token;

  if (jwtAuthenticatorAssuranceLevel(accessToken) === "aal2") {
    return false;
  }

  const runAssurance = () => supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  let { data: assurance, error: assuranceErr } = await runAssurance();

  if (assuranceErr) {
    if (sessionHint) {
      /** Logo após login, não refrescar de imediato — pode misturar estado; só repetir AAL. */
      await new Promise((r) => setTimeout(r, 120));
      ({ data: assurance, error: assuranceErr } = await runAssurance());
    }
    if (assuranceErr && !sessionHint) {
      await supabase.auth.refreshSession();
      const { data: s2 } = await supabase.auth.getSession();
      const t2 = s2.session?.access_token;
      if (t2 && jwtAuthenticatorAssuranceLevel(t2) === "aal2") {
        return false;
      }
      if (t2) accessToken = t2;
      ({ data: assurance, error: assuranceErr } = await runAssurance());
    }
  }

  const apiRequiresStepUp =
    !assuranceErr &&
    assurance?.nextLevel === "aal2" &&
    assurance?.currentLevel !== "aal2";

  if (apiRequiresStepUp) {
    return true;
  }

  const hasVerifiedTotp = await hasVerifiedTotpFactor(supabase);
  if (hasVerifiedTotp && jwtAuthenticatorAssuranceLevel(accessToken) !== "aal2") {
    return true;
  }

  return false;
}

/** Fator TOTP já verificado para o `auth.uid()` da sessão atual (não mistura contas). */
export async function getVerifiedTotpFactorId(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return null;
  const f = (data?.totp ?? []).find((x) => x.status === "verified");
  return f?.id ?? null;
}
