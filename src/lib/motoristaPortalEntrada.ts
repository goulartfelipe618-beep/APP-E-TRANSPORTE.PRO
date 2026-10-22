import { tokenAplicativoMotoristaGuardado } from "@/lib/capacitorFrota";
import { supabase } from "@/integrations/supabase/client";

const ENTRADA_KEY = "etp_frota_link_entrada";
const AVISO_KEY = "etp_portal_login_aviso";
const PREVIEW_KEY = "etp_frota_preview_dono";

export const MSG_MINI_PAINEL_SO_PELO_LINK =
  "O mini painel do motorista só abre pelo link exclusivo gerado no cadastro. O login do painel não aceita esta conta.";

/** Conta criada pelo link /frota/acesso. Não entra no login da empresa. */
export function emailEhContaDeMotoristaPortal(email: string): boolean {
  return email.trim().toLowerCase().endsWith("@motorista-frota.local");
}

/**
 * O mini painel continua exigindo outro navegador quando já há outra conta aberta.
 * Sair ou expirar neste navegador não pode derrubar as outras pessoas no mesmo link.
 */
export function saidaDoMiniPainelEhLocal(pathname: string): boolean {
  return pathname.startsWith("/frota");
}

/** Entrar com outro e-mail no mesmo navegador apagaria a sessão que já está aberta. */
export function loginDoMotoristaTrocaraOutraConta(emailAtual: string | null | undefined, emailDoLink: string): boolean {
  const atual = (emailAtual ?? "").trim().toLowerCase();
  const novo = emailDoLink.trim().toLowerCase();
  if (!atual || !novo) return false;
  return atual !== novo;
}

type EntradaGravada = { userId?: string; token?: string };

export function lerTokenDaEntrada(raw: string | null, userId: string): string | null {
  if (!raw || !userId) return null;
  try {
    const parsed = JSON.parse(raw) as EntradaGravada;
    const token = (parsed.token ?? "").trim();
    if (!token || parsed.userId !== userId) return null;
    return token;
  } catch {
    return null;
  }
}

export function marcarEntradaPeloLinkUnico(userId: string, token: string): void {
  if (typeof window === "undefined") return;
  const limpo = token.trim();
  if (!userId || !limpo) return;
  try {
    sessionStorage.setItem(ENTRADA_KEY, JSON.stringify({ userId, token: limpo }));
  } catch {
    /* ignore */
  }
}

export function limparEntradaPeloLinkUnico(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ENTRADA_KEY);
  } catch {
    /* ignore */
  }
}

export function tokenEntradaPeloLinkUnico(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return lerTokenDaEntrada(sessionStorage.getItem(ENTRADA_KEY), userId);
  } catch {
    return null;
  }
}

export function guardarAvisoLoginPortal(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(AVISO_KEY, MSG_MINI_PAINEL_SO_PELO_LINK);
  } catch {
    /* ignore */
  }
}

export type PreviewMiniPainel = {
  ownerId: string;
  token: string;
  fichaId: string;
  portalAuthUserId: string;
  nome: string;
};

/**
 * O dono da ficha, ou o admin master, pode abrir o mini painel numa guia nova
 * sem substituir a sessão do painel. Outra conta não pode.
 */
export function sessaoPodeAbrirMiniPainelDoDono(opts: {
  sessionUserId: string;
  fichaUserId: string;
  papel: string | null;
}): boolean {
  const sessao = opts.sessionUserId.trim();
  const dono = opts.fichaUserId.trim();
  if (!sessao || !dono) return false;
  if (sessao === dono) return true;
  return opts.papel === "admin_master";
}

export function lerPreviewDoDono(raw: string | null): PreviewMiniPainel | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PreviewMiniPainel>;
    const ownerId = String(parsed.ownerId ?? "").trim();
    const token = String(parsed.token ?? "").trim();
    const fichaId = String(parsed.fichaId ?? "").trim();
    if (!ownerId || !token || !fichaId) return null;
    return {
      ownerId,
      token,
      fichaId,
      portalAuthUserId: String(parsed.portalAuthUserId ?? "").trim(),
      nome: String(parsed.nome ?? "").trim(),
    };
  } catch {
    return null;
  }
}

export function marcarPreviewDoDono(preview: PreviewMiniPainel): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(preview));
  } catch {
    /* ignore */
  }
}

export function limparPreviewDoDono(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PREVIEW_KEY);
  } catch {
    /* ignore */
  }
}

export function previewDoDonoGuardada(): PreviewMiniPainel | null {
  if (typeof window === "undefined") return null;
  try {
    return lerPreviewDoDono(sessionStorage.getItem(PREVIEW_KEY));
  } catch {
    return null;
  }
}

export function consumirAvisoLoginPortal(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const aviso = sessionStorage.getItem(AVISO_KEY);
    sessionStorage.removeItem(AVISO_KEY);
    return aviso;
  } catch {
    return null;
  }
}

async function linkPertenceAoMotorista(userId: string, token: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const metaId = String(
    (auth.user?.user_metadata as { solicitacao_motorista_id?: unknown } | undefined)?.solicitacao_motorista_id ?? "",
  ).trim();
  let query = supabase
    .from("solicitacoes_motoristas")
    .select("id")
    .eq("portal_token", token)
    .eq("portal_auth_user_id", userId)
    .eq("status", "cadastrado");
  if (metaId) query = query.eq("id", metaId);
  const { data, error } = await query.maybeSingle();
  return !error && !!data?.id;
}

/** A ficha deste login tem de ser a dona do link aberto. Sem isso o painel não abre. */
export async function confirmarEntradaPeloLinkUnico(userId: string, token: string): Promise<boolean> {
  const limpo = token.trim();
  if (!userId || !limpo) return false;
  const ok = await linkPertenceAoMotorista(userId, limpo);
  if (!ok) {
    limparEntradaPeloLinkUnico();
    return false;
  }
  marcarEntradaPeloLinkUnico(userId, limpo);
  return true;
}

/** Confirma no banco que esta sessão pode ver o motorista deste link. Não troca o login. */
export async function entrarNoMiniPainelComoDono(token: string): Promise<PreviewMiniPainel | null> {
  const limpo = token.trim();
  if (!limpo) return null;
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? "";
  if (!uid) return null;
  const { data, error } = await supabase
    .from("solicitacoes_motoristas")
    .select("id, user_id, portal_auth_user_id, nome, portal_token")
    .eq("portal_token", limpo)
    .eq("status", "cadastrado")
    .maybeSingle();
  if (error || !data?.id || String(data.portal_token ?? "").trim() !== limpo) return null;
  const { data: papel } = await supabase.rpc("get_session_primary_role");
  if (
    !sessaoPodeAbrirMiniPainelDoDono({
      sessionUserId: uid,
      fichaUserId: String(data.user_id ?? ""),
      papel: typeof papel === "string" ? papel : null,
    })
  ) {
    return null;
  }
  const preview: PreviewMiniPainel = {
    ownerId: String(data.user_id),
    token: limpo,
    fichaId: String(data.id),
    portalAuthUserId: String(data.portal_auth_user_id ?? "").trim(),
    nome: String(data.nome ?? "").trim(),
  };
  marcarPreviewDoDono(preview);
  return preview;
}

/** A guia atual está no mini painel de um motorista desta sessão, e a ficha ainda é dela. */
export async function validarMiniPainelDoDono(): Promise<PreviewMiniPainel | null> {
  const guardada = previewDoDonoGuardada();
  if (!guardada) return null;
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? "";
  if (!uid) {
    limparPreviewDoDono();
    return null;
  }
  const { data, error } = await supabase
    .from("solicitacoes_motoristas")
    .select("id, user_id, portal_auth_user_id, nome, portal_token")
    .eq("id", guardada.fichaId)
    .eq("portal_token", guardada.token)
    .eq("user_id", guardada.ownerId)
    .eq("status", "cadastrado")
    .maybeSingle();
  if (error || !data?.id) {
    limparPreviewDoDono();
    return null;
  }
  const { data: papel } = await supabase.rpc("get_session_primary_role");
  if (
    !sessaoPodeAbrirMiniPainelDoDono({
      sessionUserId: uid,
      fichaUserId: String(data.user_id ?? ""),
      papel: typeof papel === "string" ? papel : null,
    })
  ) {
    limparPreviewDoDono();
    return null;
  }
  const preview: PreviewMiniPainel = {
    ownerId: String(data.user_id),
    token: guardada.token,
    fichaId: String(data.id),
    portalAuthUserId: String(data.portal_auth_user_id ?? "").trim(),
    nome: String(data.nome ?? "").trim(),
  };
  marcarPreviewDoDono(preview);
  return preview;
}

export async function entradaDoPortalEstaValida(userId: string): Promise<boolean> {
  const token = tokenEntradaPeloLinkUnico(userId) ?? tokenAplicativoMotoristaGuardado();
  if (!token) return false;
  const ok = await linkPertenceAoMotorista(userId, token);
  if (!ok) {
    limparEntradaPeloLinkUnico();
    return false;
  }
  marcarEntradaPeloLinkUnico(userId, token);
  return true;
}
