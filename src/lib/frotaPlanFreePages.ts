/**
 * Páginas do painel motorista (frota /dashboard) liberadas no plano FREE.
 * Demais rotas exigem plano PRÓ.
 */
export const FROTA_FREE_PAGE_IDS = new Set<string>([
  "home",
  "abrangencia",
  "atualizacoes",
  "metricas",
  "transfer/solicitacoes",
  "transfer/reservas",
  "transfer/contrato",
  "grupos/solicitacoes",
  "grupos/reservas",
  "grupos/contrato",
  "motoristas/cadastros",
  "motoristas/solicitacoes",
  "veiculos",
  "empty-legs",
  "mentoria",
  "marketing/receptivos",
  "marketing/qrcode",
  "comunidade",
  "sistema/configuracoes",
  "anotacoes",
  "tickets",
]);

export function isFrotaFreePage(pageId: string): boolean {
  return FROTA_FREE_PAGE_IDS.has(pageId);
}
