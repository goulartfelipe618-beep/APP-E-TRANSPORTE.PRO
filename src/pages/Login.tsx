import { useState, useCallback, useEffect, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HelpCircle, Key, Lock, LogIn, Mail, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPostLoginPath } from "@/lib/sessionRole";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_LOGIN_PAINEL_CONFIG,
  mergeLoginPainelConfig,
  type LoginPainelConfig,
} from "@/lib/loginPainelConfig";
import LoginAvisosBanner from "@/components/LoginAvisosBanner";
import { applyDocumentClassDark } from "@/lib/panelTheme";
import { clearAuthStartedAt, isAuthExpired, readAuthStartedAt, setAuthStartedAt } from "@/lib/authExpiry";

/** Persistência opcional; não ler na montagem — evita exibir URL antiga da imagem antes do fetch. */
const LOGIN_CONFIG_CACHE_KEY = "etp_login_painel_config_v1";

function writeLoginConfigCache(config: LoginPainelConfig) {
  try {
    sessionStorage.setItem(LOGIN_CONFIG_CACHE_KEY, JSON.stringify(config));
  } catch {
    /* ignore */
  }
}

function generateCaptcha(length = 6): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const Login = () => {
  const navigate = useNavigate();
  const [gateReady, setGateReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [idioma, setIdioma] = useState("pt-BR");
  const [loginConfig, setLoginConfig] = useState<LoginPainelConfig | null>(null);
  const [lateralImageReady, setLateralImageReady] = useState(false);

  useLayoutEffect(() => {
    // Regra adicional: login SEMPRE em tema claro.
    applyDocumentClassDark(false);
  }, []);

  useEffect(() => {
    // Se a sessão ainda estiver válida (dentro de 24h), não deve ser possível voltar ao /login.
    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (session) {
        const startedAt = readAuthStartedAt();
        if (!startedAt) setAuthStartedAt(Date.now());

        const started = startedAt ?? Date.now();
        if (startedAt && isAuthExpired(startedAt)) {
          clearAuthStartedAt();
          await supabase.auth.signOut();
          setGateReady(true);
          return;
        }

        const path = await getPostLoginPath(session.user.id);
        navigate(path, { replace: true });
        return;
      }

      setGateReady(true);
    })();
  }, [navigate]);

  const refreshCaptcha = useCallback(() => {
    setCaptcha(generateCaptcha());
    setCaptchaInput("");
  }, []);

  useEffect(() => {
    refreshCaptcha();
  }, [refreshCaptcha]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("login_painel_config").select("*").eq("id", 1).maybeSingle();
      const merged = mergeLoginPainelConfig(data as Partial<LoginPainelConfig>);
      setLoginConfig(merged);
      setIdioma(merged.idioma_padrao || "pt-BR");
      writeLoginConfigCache(merged);
    })();
  }, []);

  useEffect(() => {
    const url = loginConfig?.imagem_lateral_url;
    if (!url) {
      setLateralImageReady(false);
      return;
    }
    setLateralImageReady(false);
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      void (async () => {
        try {
          if ("decode" in img && typeof img.decode === "function") {
            await img.decode();
          }
        } catch {
          /* decode opcional */
        }
        if (!cancelled) setLateralImageReady(true);
      })();
    };
    img.onerror = () => {
      if (!cancelled) setLateralImageReady(true);
    };
    img.src = url;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [loginConfig?.imagem_lateral_url]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (captchaInput !== captcha) {
      setError("Código de verificação incorreto.");
      refreshCaptcha();
      return;
    }

    setLoading(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      refreshCaptcha();
      return;
    }

    // Se o usuário já tiver TOTP enrolado mas ainda não fez o desafio (aal1 -> aal2),
    // direciona para a tela de verificação 2FA antes de consultar roles no banco.
    try {
      const { data: assuranceData, error: assuranceErr } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (!assuranceErr && assuranceData?.nextLevel === "aal2" && assuranceData?.currentLevel !== "aal2") {
        setLoading(false);
        navigate("/mfa", { replace: true });
        return;
      }
    } catch {
      // Caso a verificação de AAL falhe, seguimos com o fluxo normal.
    }

    const path = await getPostLoginPath(data.user.id);
    setAuthStartedAt(Date.now());
    navigate(path, { replace: true });
  };

  if (!gateReady) {
    return (
      <div className="fixed inset-0 z-0 flex h-[100dvh] w-full max-w-none items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-0 flex h-[100dvh] w-full max-w-none flex-col overflow-hidden bg-white lg:flex-row lg:gap-0 lg:items-stretch">
      <aside className="hidden h-full min-h-0 shrink-0 overflow-hidden bg-white p-0 lg:block lg:w-1/2 lg:max-w-[50%]">
        {loginConfig && lateralImageReady ? (
          <img
            key={loginConfig.imagem_lateral_url}
            src={loginConfig.imagem_lateral_url}
            alt=""
            className="h-full w-full object-contain object-left"
          />
        ) : null}
      </aside>

      <section className="h-full min-h-0 w-full shrink-0 overflow-hidden bg-white lg:w-1/2 lg:max-w-[50%]">
        <div className="flex h-full w-full max-w-xl flex-col px-4 py-3 sm:px-6 lg:pl-6 lg:pr-8">
          <div className="mb-3 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => window.open("mailto:suporte@e-transporte.pro", "_blank")}>
              <HelpCircle className="h-4 w-4" />
              {loginConfig?.texto_botao_ajuda ?? "Ajuda"}
            </Button>
            <select
              value={idioma}
              onChange={(e) => setIdioma(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Idioma"
            >
              <option value="pt-BR">PT-BR</option>
              <option value="en-US">EN</option>
              <option value="es-ES">ES</option>
            </select>
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
            <LoginAvisosBanner />

            <header className="space-y-1">
              <p className="text-xs font-semibold tracking-wide text-primary">E-TRANSPORTE.PRO</p>
              <h1 className="text-2xl font-bold leading-tight text-foreground">{loginConfig?.painel_titulo ?? "Painel E-Transporte.pro"}</h1>
              <p className="text-xs text-muted-foreground">{loginConfig?.painel_subtitulo ?? ""}</p>
            </header>

            <Card className="border-border shadow-sm">
              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="text-xl">{loginConfig?.form_titulo ?? "Faça seu login"}</CardTitle>
                <p className="text-xs text-muted-foreground">{loginConfig?.form_legenda ?? ""}</p>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <form onSubmit={handleLogin} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-user" className="text-xs">Usuario</Label>
                    <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-user"
                        type="email"
                        placeholder={loginConfig?.placeholder_usuario ?? "Email ou usuário"}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="border-0 px-0 shadow-none focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="login-pass" className="text-xs">Senha</Label>
                    <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-pass"
                        type="password"
                        placeholder={loginConfig?.placeholder_senha ?? "Senha"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="border-0 px-0 shadow-none focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Codigo de seguranca</Label>
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <div className="rounded-md border bg-muted px-4 py-1.5 text-sm font-mono tracking-widest line-through decoration-muted-foreground/40">
                        {captcha}
                      </div>
                      <button
                        type="button"
                        onClick={refreshCaptcha}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted"
                        aria-label="Gerar novo captcha"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder={loginConfig?.placeholder_captcha ?? "Digite o código acima"}
                        value={captchaInput}
                        onChange={(e) => setCaptchaInput(e.target.value)}
                        required
                        className="border-0 px-0 shadow-none focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  <div className="text-right leading-none">
                    <a className="text-xs text-primary hover:underline" href="mailto:suporte@e-transporte.pro">
                      {loginConfig?.texto_esqueci_senha ?? "Esqueci minha senha"}
                    </a>
                  </div>

                  {error ? <p className="text-sm text-destructive">{error}</p> : null}

                  <Button type="submit" disabled={loading} className="w-full gap-2">
                    <LogIn className="h-4 w-4" />
                    {loading ? "Entrando..." : loginConfig?.texto_botao_login ?? "Iniciar sessão"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Alert className="bg-slate-50 border-slate-200 px-4 py-3">
              <AlertTitle className="text-sm">{loginConfig?.seguranca_titulo ?? "Checkup de segurança"}</AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-0.5 pl-5 text-xs">
                  {(loginConfig?.seguranca_itens ?? DEFAULT_LOGIN_PAINEL_CONFIG.seguranca_itens).map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          </div>

          <footer className="mt-3 text-center text-[11px] text-muted-foreground">{loginConfig?.rodape_texto ?? ""}</footer>
        </div>
      </section>
    </div>
  );
};

export default Login;
