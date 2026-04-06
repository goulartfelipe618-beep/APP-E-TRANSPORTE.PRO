import luxuryCar from "@/assets/luxury-car.jpg";

export type LoginPainelConfig = {
  imagem_lateral_url: string;
  painel_titulo: string;
  painel_subtitulo: string;
  form_titulo: string;
  form_legenda: string;
  placeholder_usuario: string;
  placeholder_senha: string;
  placeholder_captcha: string;
  texto_esqueci_senha: string;
  texto_botao_login: string;
  seguranca_titulo: string;
  seguranca_itens: string[];
  rodape_texto: string;
  texto_botao_ajuda: string;
  idioma_padrao: string;
};

export const DEFAULT_LOGIN_PAINEL_CONFIG: LoginPainelConfig = {
  imagem_lateral_url: luxuryCar,
  painel_titulo: "Painel E-Transporte.pro",
  painel_subtitulo: "Acesse com seguranca para gerir sua operacao.",
  form_titulo: "Faca seu login",
  form_legenda: "Use seu usuario e senha para entrar no painel.",
  placeholder_usuario: "Email ou usuario",
  placeholder_senha: "Senha",
  placeholder_captcha: "Digite o codigo acima",
  texto_esqueci_senha: "Esqueci minha senha",
  texto_botao_login: "Iniciar sessao",
  seguranca_titulo: "Checkup de seguranca",
  seguranca_itens: [
    "Nunca compartilhe sua senha com terceiros.",
    "Verifique o codigo de seguranca antes de entrar.",
    "Ative 2FA no menu Sistema > Configuracoes.",
  ],
  rodape_texto: "© 2026 - Todos os direitos reservados.",
  texto_botao_ajuda: "Ajuda",
  idioma_padrao: "pt-BR",
};

export function mergeLoginPainelConfig(data: Partial<LoginPainelConfig> | null | undefined): LoginPainelConfig {
  const it = Array.isArray(data?.seguranca_itens)
    ? data?.seguranca_itens.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : DEFAULT_LOGIN_PAINEL_CONFIG.seguranca_itens;

  return {
    imagem_lateral_url: data?.imagem_lateral_url || DEFAULT_LOGIN_PAINEL_CONFIG.imagem_lateral_url,
    painel_titulo: data?.painel_titulo || DEFAULT_LOGIN_PAINEL_CONFIG.painel_titulo,
    painel_subtitulo: data?.painel_subtitulo || DEFAULT_LOGIN_PAINEL_CONFIG.painel_subtitulo,
    form_titulo: data?.form_titulo || DEFAULT_LOGIN_PAINEL_CONFIG.form_titulo,
    form_legenda: data?.form_legenda || DEFAULT_LOGIN_PAINEL_CONFIG.form_legenda,
    placeholder_usuario: data?.placeholder_usuario || DEFAULT_LOGIN_PAINEL_CONFIG.placeholder_usuario,
    placeholder_senha: data?.placeholder_senha || DEFAULT_LOGIN_PAINEL_CONFIG.placeholder_senha,
    placeholder_captcha: data?.placeholder_captcha || DEFAULT_LOGIN_PAINEL_CONFIG.placeholder_captcha,
    texto_esqueci_senha: data?.texto_esqueci_senha || DEFAULT_LOGIN_PAINEL_CONFIG.texto_esqueci_senha,
    texto_botao_login: data?.texto_botao_login || DEFAULT_LOGIN_PAINEL_CONFIG.texto_botao_login,
    seguranca_titulo: data?.seguranca_titulo || DEFAULT_LOGIN_PAINEL_CONFIG.seguranca_titulo,
    seguranca_itens: it.length > 0 ? it : DEFAULT_LOGIN_PAINEL_CONFIG.seguranca_itens,
    rodape_texto: data?.rodape_texto || DEFAULT_LOGIN_PAINEL_CONFIG.rodape_texto,
    texto_botao_ajuda: data?.texto_botao_ajuda || DEFAULT_LOGIN_PAINEL_CONFIG.texto_botao_ajuda,
    idioma_padrao: data?.idioma_padrao || DEFAULT_LOGIN_PAINEL_CONFIG.idioma_padrao,
  };
}
