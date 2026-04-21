/**
 * Páginas do painel motorista (frota /dashboard) liberadas no plano FREE.
 * Demais rotas exigem plano PRÓ para edição / uso completo (gating na UI).
 *
 * Importante: esta lista define **acesso**, não retenção — ao cair para FREE, dados PRÓ
 * permanecem na base; o utilizador só deixa de poder usar essas áreas até voltar ao PRÓ.
 */
export const FROTA_FREE_PAGE_IDS = new Set<string>([
  "home",
  "abrangencia",
  "agenda",
  "atualizacoes",
  "metricas",
  "transfer/solicitacoes",
  "transfer/reservas",
  "transfer/contrato",
  "grupos/solicitacoes",
  "grupos/reservas",
  "grupos/contrato",
  "motoristas/cadastros",
  "veiculos",
  "empty-legs",
  "mentoria",
  "marketing/receptivos",
  "marketing/qrcode",
  "comunidade",
  "sistema/configuracoes",
  "sistema/automacoes",
  "anotacoes",
  "tickets",
  "financeiro",
  "financeiro/lancamentos",
  "financeiro/receber",
  "financeiro/pagar",
  "financeiro/relatorios",
]);

export function isFrotaFreePage(pageId: string): boolean {
  return FROTA_FREE_PAGE_IDS.has(pageId);
}
