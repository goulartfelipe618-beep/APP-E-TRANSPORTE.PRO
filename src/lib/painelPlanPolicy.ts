/**
 * Regras de plano para o painel `admin_transfer` (FREE, STANDART, PRÓ).
 * Valores em `user_plans.plano`: `free` | `standart` | `pro`.
 *
 * O cliente só reflete preferência de UI — qualquer cobrança ou desbloqueio real (ex.: Mercado Pago)
 * deve ser confirmado no servidor (webhook assinado, `user_plans` atualizado pela API).
 */

export type PlanType = "free" | "standart" | "pro";

const PLAN_RANK: Record<PlanType, number> = {
  free: 0,
  standart: 1,
  pro: 2,
};

const LEGACY_PAID = new Set(["seed", "grow", "rise", "apex", "premium"]);

/** Páginas que exigem plano PRÓ para aceder / usar. */
const PAGES_MIN_PRO = new Set<string>([
  "transfer/solicitacoes",
  "grupos/solicitacoes",
  "motoristas/solicitacoes",
  "email-business",
  "website",
  "dominios",
  "sistema/automacoes",
]);

/** Páginas que exigem STANDART ou PRÓ (bloqueadas no FREE). */
const PAGES_MIN_STANDART = new Set<string>(["transfer/contrato", "grupos/contrato", "campanhas/ativos", "campanhas/leads"]);

/** Itens de menu onde não mostramos badge de upgrade (acesso no FREE com outras regras ou beta). */
export const PAGES_SEM_BADGE_PLANO = new Set<string>([
  "transfer/geolocalizacao",
  "disparador",
  "empty-legs",
  "sistema/comunicador",
  "whatsapp",
  "network",
  "comunidade",
  "mentoria",
]);

export function normalizeUserPlano(raw: string | null | undefined): PlanType {
  if (!raw) return "free";
  const p = String(raw).toLowerCase().trim();
  if (p === "free") return "free";
  if (p === "standart" || p === "standard") return "standart";
  if (p === "pro" || LEGACY_PAID.has(p)) return "pro";
  return "free";
}

export function planMeetsMinimum(plano: PlanType, min: PlanType): boolean {
  return PLAN_RANK[plano] >= PLAN_RANK[min];
}

/** Se o utilizador pode abrir a página com o plano atual (navegação + ecrã principal). */
export function pageAllowedForPlan(plano: PlanType, pageId: string): boolean {
  if (PAGES_MIN_PRO.has(pageId)) return plano === "pro";
  if (PAGES_MIN_STANDART.has(pageId)) return planMeetsMinimum(plano, "standart");
  return true;
}

/** Plano mínimo para a página, ou `null` se acessível no FREE sem restrição de tier. */
export function minimumPlanForPage(pageId: string): PlanType | null {
  if (PAGES_MIN_PRO.has(pageId)) return "pro";
  if (PAGES_MIN_STANDART.has(pageId)) return "standart";
  return null;
}

/**
 * Etiqueta curta para o menu quando o plano atual não chega (FREE vs STANDART+ vs PRÓ).
 */
export function sidebarPlanBadgeLabel(plano: PlanType, pageId: string): "PRÓ" | "ST+" | null {
  if (PAGES_SEM_BADGE_PLANO.has(pageId)) return null;
  const min = minimumPlanForPage(pageId);
  if (!min) return null;
  if (planMeetsMinimum(plano, min)) return null;
  return min === "pro" ? "PRÓ" : "ST+";
}

export const FREE_MAX_RESERVAS_DIA = 3;
export const FREE_MAX_MOTORISTAS_CADASTRADOS = 3;
export const FREE_MAX_LINKS_GEO_MES = 3;

export function canUseMotoristaPortalLink(plano: PlanType): boolean {
  return plano === "pro";
}
