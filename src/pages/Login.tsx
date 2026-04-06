import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HelpCircle, Key, Lock, LogIn, Mail, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPostLoginPath } from "@/lib/sessionRole";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mergeLoginPainelConfig, type LoginPainelConfig } from "@/lib/loginPainelConfig";
import LoginAvisosBanner from "@/components/LoginAvisosBanner";

const LOGIN_CONFIG_CACHE_KEY = "etp_login_painel_config_v1";

function readLoginConfigCache(): LoginPainelConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LOGIN_CONFIG_CACHE_KEY);
    if (!raw) return null;
    return mergeLoginPainelConfig(JSON.parse(raw) as Partial<LoginPainelConfig>);
  } catch {
    return null;
  }
}

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [idioma, setIdioma] = useState("pt-BR");
  const [loginConfig, setLoginConfig] = useState<LoginPainelConfig | null>(() => readLoginConfigCache());
  const [configReady, setConfigReady] = useState(() => readLoginConfigCache() !== null);

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
      setConfigReady(true);
    })();
  }, []);

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
        navigate("/mfa");
        return;
      }
    } catch {
      // Caso a verificação de AAL falhe, seguimos com o fluxo normal.
    }

    const path = await getPostLoginPath(data.user.id);
    navigate(path);
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-white lg:flex lg:items-stretch">
      <aside className="hidden h-screen lg:block lg:w-1/2 bg-white">
        {configReady && loginConfig ? (
          <img src={loginConfig.imagem_lateral_url} alt="" className="h-full w-full object-contain object-center" />
        ) : null}
      </aside>

      <section className="h-screen w-full overflow-hidden bg-white lg:w-1/2">
        <div className="mx-auto flex h-full w-full max-w-xl flex-col px-4 py-3 sm:px-6">
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
                  {(loginConfig?.seguranca_itens ?? []).map((item, idx) => (
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
