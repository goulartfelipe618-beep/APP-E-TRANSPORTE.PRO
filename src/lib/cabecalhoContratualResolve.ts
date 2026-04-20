/**
 * Quando `possui_cnpj === 'nao'`, os contratos usam os dados do Meu Perfil (`configuracoes`)
 * em vez dos campos próprios do cabeçalho (exceto logotipo contratual, se existir).
 */
export type CabecalhoContratualRow = Record<string, unknown> | null;
export type ConfiguracoesPerfilSlice = {
  nome_completo?: string | null;
  nome_empresa?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco_completo?: string | null;
} | null;

export function mergeCabecalhoComPerfilSeNecessario(
  cab: CabecalhoContratualRow,
  cfg: ConfiguracoesPerfilSlice,
): Record<string, unknown> | null {
  if (!cab) return null;
  if (cab.possui_cnpj !== "nao" || !cfg) return cab as Record<string, unknown>;
  return {
    ...cab,
    razao_social: String(cfg.nome_empresa ?? cab.razao_social ?? "").trim() || String(cab.razao_social ?? ""),
    cnpj: "Não possui CNPJ — dados do perfil",
    endereco_sede: String(cfg.endereco_completo ?? cab.endereco_sede ?? "").trim() || String(cab.endereco_sede ?? ""),
    telefone: String(cfg.telefone ?? cab.telefone ?? "").trim() || String(cab.telefone ?? ""),
    whatsapp: String(cfg.telefone ?? cab.whatsapp ?? "").trim() || String(cab.whatsapp ?? ""),
    email_oficial: String(cfg.email ?? cab.email_oficial ?? "").trim() || String(cab.email_oficial ?? ""),
    representante_legal: String(cfg.nome_completo ?? cab.representante_legal ?? "").trim() || String(cab.representante_legal ?? ""),
  };
}
