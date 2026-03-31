import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Configuracoes {
  nome_projeto: string;
  nome_completo: string;
  logo_url: string;
  fonte_global: string;
}

interface ConfiguracoesContextType {
  config: Configuracoes;
  refreshConfig: () => Promise<void>;
}

const defaultConfig: Configuracoes = {
  nome_projeto: "E-Transporte.pro",
  nome_completo: "",
  logo_url: "",
  fonte_global: "montserrat",
};

const ConfiguracoesContext = createContext<ConfiguracoesContextType>({
  config: defaultConfig,
  refreshConfig: async () => {},
});

export const useConfiguracoes = () => useContext(ConfiguracoesContext);

const FONT_MAP: Record<string, string> = {
  montserrat: "'Montserrat', sans-serif",
  inter: "'Inter', sans-serif",
  roboto: "'Roboto', sans-serif",
  opensans: "'Open Sans', sans-serif",
  lato: "'Lato', sans-serif",
  poppins: "'Poppins', sans-serif",
};

export function ConfiguracoesProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Configuracoes>(defaultConfig);

  const fetchConfig = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("configuracoes")
      .select("nome_projeto, nome_completo, logo_url, fonte_global")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setConfig({
        nome_projeto: data.nome_projeto || defaultConfig.nome_projeto,
        nome_completo: data.nome_completo || "",
        logo_url: data.logo_url || "",
        fonte_global: data.fonte_global || defaultConfig.fonte_global,
      });
    } else {
      setConfig(defaultConfig);
    }
  };

  useEffect(() => {
    void fetchConfig();
    const onConfigUpdated = () => void fetchConfig();
    window.addEventListener("configuracoes-updated", onConfigUpdated);
    const { data: authSub } = supabase.auth.onAuthStateChange(() => {
      void fetchConfig();
    });
    return () => {
      window.removeEventListener("configuracoes-updated", onConfigUpdated);
      authSub.subscription.unsubscribe();
    };
  }, []);

  // Apply font globally
  useEffect(() => {
    const fontFamily = FONT_MAP[config.fonte_global] || FONT_MAP.montserrat;
    document.documentElement.style.fontFamily = fontFamily;
  }, [config.fonte_global]);

  return (
    <ConfiguracoesContext.Provider value={{ config, refreshConfig: fetchConfig }}>
      {children}
    </ConfiguracoesContext.Provider>
  );
}
