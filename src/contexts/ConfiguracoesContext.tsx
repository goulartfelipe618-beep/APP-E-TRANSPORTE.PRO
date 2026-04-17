import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPersistedSupabaseUserId } from "@/lib/supabaseSessionUser";
import { FONTE_GLOBAL_PADRAO, resolveFonteCss } from "@/lib/fontesGlobais";

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
  fonte_global: FONTE_GLOBAL_PADRAO,
};

const CACHE_KEY = "etp_configuracoes_v1";

type CachePayload = { userId: string; config: Configuracoes };

const ConfiguracoesContext = createContext<ConfiguracoesContextType>({
  config: defaultConfig,
  refreshConfig: async () => {},
});

export const useConfiguracoes = () => useContext(ConfiguracoesContext);

function readConfigCache(): Configuracoes | null {
  if (typeof window === "undefined") return null;
  const sessionUid = getPersistedSupabaseUserId();
  if (!sessionUid) return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as CachePayload;
    if (payload.userId !== sessionUid || !payload.config) return null;
    const c = payload.config;
    return {
      nome_projeto: typeof c.nome_projeto === "string" ? c.nome_projeto : defaultConfig.nome_projeto,
      nome_completo: typeof c.nome_completo === "string" ? c.nome_completo : "",
      logo_url: typeof c.logo_url === "string" ? c.logo_url : "",
      fonte_global: typeof c.fonte_global === "string" ? c.fonte_global : defaultConfig.fonte_global,
    };
  } catch {
    return null;
  }
}

function writeConfigCache(userId: string, config: Configuracoes) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ userId, config } satisfies CachePayload));
  } catch {
    /* quota / private mode */
  }
}

function clearConfigCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

function mergeConfigFromRow(data: {
  nome_projeto: string | null;
  nome_completo: string | null;
  logo_url: string | null;
  fonte_global: string | null;
}): Configuracoes {
  return {
    nome_projeto: data.nome_projeto || defaultConfig.nome_projeto,
    nome_completo: data.nome_completo || "",
    logo_url: data.logo_url || "",
    fonte_global: data.fonte_global || defaultConfig.fonte_global,
  };
}

export function ConfiguracoesProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Configuracoes>(() => readConfigCache() ?? defaultConfig);

  const fetchConfig = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      clearConfigCache();
      setConfig(defaultConfig);
      return;
    }

    const { data } = await supabase
      .from("configuracoes")
      .select("nome_projeto, nome_completo, logo_url, fonte_global")
      .eq("user_id", user.id)
      .maybeSingle();

    const next: Configuracoes = data ? mergeConfigFromRow(data) : defaultConfig;
    setConfig(next);
    writeConfigCache(user.id, next);
  };

  useEffect(() => {
    void fetchConfig();
    const onConfigUpdated = () => void fetchConfig();
    window.addEventListener("configuracoes-updated", onConfigUpdated);
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        clearConfigCache();
        setConfig(defaultConfig);
        return;
      }
      void fetchConfig();
    });
    return () => {
      window.removeEventListener("configuracoes-updated", onConfigUpdated);
      authSub.subscription.unsubscribe();
    };
  }, []);

  useLayoutEffect(() => {
    document.documentElement.style.fontFamily = resolveFonteCss(config.fonte_global);
  }, [config.fonte_global]);

  return (
    <ConfiguracoesContext.Provider value={{ config, refreshConfig: fetchConfig }}>
      {children}
    </ConfiguracoesContext.Provider>
  );
}
