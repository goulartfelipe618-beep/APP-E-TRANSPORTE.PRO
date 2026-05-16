/** Logo padrão da plataforma quando o operador ainda não enviou imagem em Configurações. */
export const PLATFORM_LOGO_URL = "/favicon.ico";

export function resolvePainelLogoUrl(userLogoUrl: string | null | undefined): string {
  const trimmed = String(userLogoUrl ?? "").trim();
  return trimmed.length > 0 ? trimmed : PLATFORM_LOGO_URL;
}
