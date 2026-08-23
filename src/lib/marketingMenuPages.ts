/** Páginas do menu Marketing (painel empresa) controladas pelo Admin Master. */
export const MARKETING_MENU_PAGES = [
  "campanhas/ativos",
  "campanhas/leads",
  "email-business",
  "website",
  "dominios",
  "comunidade",
  "network",
] as const;

export type MarketingMenuPage = (typeof MARKETING_MENU_PAGES)[number];

export function isMarketingMenuPage(page: string): boolean {
  return (MARKETING_MENU_PAGES as readonly string[]).includes(page);
}
