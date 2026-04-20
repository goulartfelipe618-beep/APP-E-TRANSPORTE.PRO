import { supabase } from "@/integrations/supabase/client";

export type MotoristaOnboardingStatus = {
  loading: boolean;
  /** Perfil, nome projeto, fonte, contratual e senha redefinida. */
  phase1Complete: boolean;
  /** `network_nacional_aceito` em `sim` ou `nao` na base. */
  networkChosen: boolean;
  /** Mensagens curtas para UI (lista de pendências). */
  pendencias: string[];
};

function trim(s: unknown): string {
  return String(s ?? "").trim();
}

/**
 * Avalia se o motorista concluiu onboarding (configurações obrigatórias + escolha Network).
 */
export async function evaluateMotoristaOnboarding(userId: string): Promise<Omit<MotoristaOnboardingStatus, "loading">> {
  const pendencias: string[] = [];

  const [{ data: cfg }, { data: cab }] = await Promise.all([
    supabase
      .from("configuracoes")
      .select(
        "nome_completo,email,telefone,cidade,estado,endereco_completo,nome_empresa,nome_projeto,fonte_global,senha_redefinida_em,network_nacional_aceito",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("cabecalho_contratual").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  const c = cfg as Record<string, unknown> | null;
  const cabRow = cab as Record<string, unknown> | null;

  if (!trim(c?.nome_completo)) pendencias.push("Meu Perfil: nome completo");
  if (!trim(c?.email)) pendencias.push("Meu Perfil: e-mail");
  if (!trim(c?.telefone)) pendencias.push("Meu Perfil: telefone");
  if (!trim(c?.nome_empresa)) pendencias.push("Meu Perfil: nome da empresa");
  if (!trim(c?.cidade)) pendencias.push("Meu Perfil: cidade");
  if (!trim(c?.estado)) pendencias.push("Meu Perfil: estado (UF)");
  if (!trim(c?.endereco_completo)) pendencias.push("Meu Perfil: endereço completo");
  // CNPJ no perfil não é obrigatório

  if (!trim(c?.nome_projeto)) pendencias.push("Nome do projeto");
  if (!trim(c?.fonte_global)) pendencias.push("Fonte global");

  if (!c?.senha_redefinida_em) pendencias.push("Segurança: redefinir a senha (obrigatório)");

  const possui = trim(cabRow?.possui_cnpj) || "sim";
  if (possui === "sim") {
    if (!cabRow) {
      pendencias.push('Informações contratuais: indique "Possui CNPJ" e preencha o cabeçalho');
    } else {
      if (!trim(cabRow.razao_social)) pendencias.push("Informações contratuais: razão social");
      if (!trim(cabRow.cnpj)) pendencias.push("Informações contratuais: CNPJ");
      if (!trim(cabRow.endereco_sede)) pendencias.push("Informações contratuais: endereço da sede");
      if (!trim(cabRow.telefone)) pendencias.push("Informações contratuais: telefone");
      if (!trim(cabRow.whatsapp)) pendencias.push("Informações contratuais: WhatsApp");
      if (!trim(cabRow.email_oficial)) pendencias.push("Informações contratuais: e-mail oficial");
      if (!trim(cabRow.representante_legal)) pendencias.push("Informações contratuais: representante legal");
    }
  } else if (possui === "nao") {
    if (!cabRow || cabRow.possui_cnpj !== "nao") {
      pendencias.push('Informações contratuais: guarde a opção "Não possuo CNPJ" (usar dados do perfil)');
    }
  } else {
    pendencias.push('Informações contratuais: selecione se possui CNPJ (Sim ou Não)');
  }

  const net = trim(c?.network_nacional_aceito);
  const networkChosen = net === "sim" || net === "nao";

  const phase1ContratualOk =
    possui === "sim"
      ? Boolean(
          cabRow &&
            trim(cabRow.razao_social) &&
            trim(cabRow.cnpj) &&
            trim(cabRow.endereco_sede) &&
            trim(cabRow.telefone) &&
            trim(cabRow.whatsapp) &&
            trim(cabRow.email_oficial) &&
            trim(cabRow.representante_legal),
        )
      : possui === "nao"
        ? Boolean(cabRow && cabRow.possui_cnpj === "nao")
        : false;

  const perfilBasicoOk =
    Boolean(trim(c?.nome_completo)) &&
    Boolean(trim(c?.email)) &&
    Boolean(trim(c?.telefone)) &&
    Boolean(trim(c?.nome_empresa)) &&
    Boolean(trim(c?.cidade)) &&
    Boolean(trim(c?.estado)) &&
    Boolean(trim(c?.endereco_completo)) &&
    Boolean(trim(c?.nome_projeto)) &&
    Boolean(trim(c?.fonte_global)) &&
    Boolean(c?.senha_redefinida_em);

  const phase1Complete = perfilBasicoOk && phase1ContratualOk;

  return {
    phase1Complete,
    networkChosen,
    pendencias,
  };
}
