import { useState, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Key, Lock, LogIn, Mail, RefreshCw, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPostLoginPath } from "@/lib/sessionRole";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_LOGIN_PAINEL_CONFIG,
  mergeLoginPainelConfig,
  type LoginPainelConfig,
} from "@/lib/loginPainelConfig";
import LoginAvisosBanner from "@/components/LoginAvisosBanner";
import { applyDocumentClassDark, applyThemeForRoute } from "@/lib/panelTheme";
import { clearAuthStartedAt, isAuthExpired, readAuthStartedAt, setAuthStartedAt } from "@/lib/authExpiry";

/** Persistência opcional; não ler na montagem — evita exibir URL antiga da imagem antes do fetch. */
const LOGIN_CONFIG_CACHE_KEY = "etp_login_painel_config_v1";

/** Fragmento de URL típico dos links de recuperação enviados pelo Supabase Auth. */
function urlSuggestsPasswordRecovery(): boolean {
  if (typeof window === "undefined") return false;
  const { hash, search } = window.location;
  if (/type[=]recovery|type%3Drecovery/i.test(hash)) return true;
  const sp = new URLSearchParams(search);
  return sp.get("type") === "recovery";
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
  const urlRecoveryHintRef = useRef(urlSuggestsPasswordRecovery());
  const passwordRecoveryRef = useRef(urlRecoveryHintRef.current);
  const redirectDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [gateReady, setGateReady] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(() => urlRecoveryHintRef.current);
  const [recoverySessionReady, setRecoverySessionReady] = useState(false);
  const [recoveryPass, setRecoveryPass] = useState("");
  const [recoveryPass2, setRecoveryPass2] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [recoverySaving, setRecoverySaving] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginConfig, setLoginConfig] = useState<LoginPainelConfig | null>(null);
  const [lateralImageReady, setLateralImageReady] = useState(false);

  useLayoutEffect(() => {
    // Regra adicional: login SEMPRE em tema claro.
    applyDocumentClassDark(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const clearRedirectDebounce = () => {
      if (redirectDebounceRef.current != null) {
        window.clearTimeout(redirectDebounceRef.current);
        redirectDebounceRef.current = null;
      }
    };

    const enterRecoveryMode = (session: { user: { id: string } } | null) => {
      passwordRecoveryRef.current = true;
      clearRedirectDebounce();
      setPasswordRecovery(true);
      setRecoverySessionReady(Boolean(session));
      setGateReady(true);
    };

    const redirectLoggedInUser = async (session: { user: { id: string }; access_token: string }) => {
      if (cancelled || passwordRecoveryRef.current) return;

      const startedAt = readAuthStartedAt();
      if (!startedAt) setAuthStartedAt(Date.now());
      if (startedAt && isAuthExpired(startedAt)) {
        clearAuthStartedAt();
        await supabase.auth.signOut();
        setGateReady(true);
        return;
      }

      try {
        const { data: assuranceData, error: assuranceErr } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (!assuranceErr && assuranceData?.nextLevel === "aal2" && assuranceData?.currentLevel !== "aal2") {
          navigate("/mfa", { replace: true });
          return;
        }
      } catch {
        /* segue fluxo normal */
      }

      const path = await getPostLoginPath(session.user.id);
      applyThemeForRoute(path, session.user.id);
      navigate(path, { replace: true });
    };

    const scheduleRedirectIfLoggedIn = (session: { user: { id: string }; access_token: string } | null) => {
      if (!session || passwordRecoveryRef.current) {
        if (!passwordRecoveryRef.current) setGateReady(true);
        return;
      }
      clearRedirectDebounce();
      redirectDebounceRef.current = window.setTimeout(() => {
        redirectDebounceRef.current = null;
        if (cancelled || passwordRecoveryRef.current) return;
        void redirectLoggedInUser(session);
      }, 400);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        enterRecoveryMode(session);
        return;
      }

      if (event === "INITIAL_SESSION") {
        if (urlRecoveryHintRef.current && session) {
          enterRecoveryMode(session);
          return;
        }
        if (session) {
          scheduleRedirectIfLoggedIn(session);
        } else if (!passwordRecoveryRef.current) {
          setGateReady(true);
        }
      }

      if (passwordRecoveryRef.current && session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        setRecoverySessionReady(true);
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (passwordRecoveryRef.current && session) {
        setRecoverySessionReady(true);
      }
    });

    return () => {
      cancelled = true;
      clearRedirectDebounce();
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError("");
    if (recoveryPass.length < 6) {
      setRecoveryError("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (recoveryPass !== recoveryPass2) {
      setRecoveryError("As senhas não coincidem.");
      return;
    }

    setRecoverySaving(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password: recoveryPass });
      if (updateErr) {
        setRecoveryError(updateErr.message || "Não foi possível atualizar a senha.");
        return;
      }
      await supabase.auth.refreshSession();
      toast.success("Senha atualizada com sucesso.");

      try {
        const { data: assuranceData, error: assuranceErr } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (!assuranceErr && assuranceData?.nextLevel === "aal2" && assuranceData?.currentLevel !== "aal2") {
          navigate("/mfa", { replace: true });
          return;
        }
      } catch {
        /* ignora */
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      passwordRecoveryRef.current = false;
      setPasswordRecovery(false);
      setAuthStartedAt(Date.now());
      const path = await getPostLoginPath(user.id);
      applyThemeForRoute(path, user.id);
      try {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      } catch {
        /* ignore */
      }
      navigate(path, { replace: true });
    } finally {
      setRecoverySaving(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = forgotEmail.trim().toLowerCase();
    if (!em) {
      toast.error("Indique o e-mail da conta.");
      return;
    }
    const redirectTo = `${window.location.origin}/login`;
    setForgotSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(em, { redirectTo });
      if (error) {
        toast.error(error.message || "Não foi possível enviar o e-mail.");
        return;
      }
      toast.success("Se existir conta com este e-mail, receberá instruções para redefinir a senha.");
      setForgotOpen(false);
      setForgotEmail("");
    } finally {
      setForgotSending(false);
    }
  };

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
    const emailNorm = email.trim().toLowerCase();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: emailNorm,
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
    // Aplica o tema do utilizador para a rota de destino antes da navegação,
    // garantindo que o DashboardLayout monta já com a classe correcta no <html>.
    applyThemeForRoute(path, data.user.id);
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
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
            <LoginAvisosBanner />

            <header className="space-y-1">
              <p className="text-xs font-semibold tracking-wide text-primary">E-TRANSPORTE.PRO</p>
              <h1 className="text-2xl font-bold leading-tight text-foreground">{loginConfig?.painel_titulo ?? "Painel E-Transporte.pro"}</h1>
              <p className="text-xs text-muted-foreground">{loginConfig?.painel_subtitulo ?? ""}</p>
            </header>

            <Card className="border-border shadow-sm">
              {passwordRecovery ? (
                <>
                  <CardHeader className="px-4 pb-2 pt-4">
                    <CardTitle className="text-xl">Definir nova senha</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Utilize o link enviado por e-mail. Depois de guardar, acede ao painel com a nova senha.
                    </p>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    {!recoverySessionReady ? (
                      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                        <RefreshCw className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                        A validar o link de recuperação…
                      </div>
                    ) : (
                      <form onSubmit={handleRecoverySubmit} className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="recovery-pass" className="text-xs">
                            Nova senha
                          </Label>
                          <div className="flex min-h-10 items-center gap-2 rounded-md border border-input bg-background px-3 shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-0">
                            <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                            <Input
                              id="recovery-pass"
                              type="password"
                              autoComplete="new-password"
                              placeholder="Mínimo 6 caracteres"
                              value={recoveryPass}
                              onChange={(e) => setRecoveryPass(e.target.value)}
                              required
                              minLength={6}
                              className="min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="recovery-pass2" className="text-xs">
                            Confirmar nova senha
                          </Label>
                          <div className="flex min-h-10 items-center gap-2 rounded-md border border-input bg-background px-3 shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-0">
                            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                            <Input
                              id="recovery-pass2"
                              type="password"
                              autoComplete="new-password"
                              placeholder="Repita a nova senha"
                              value={recoveryPass2}
                              onChange={(e) => setRecoveryPass2(e.target.value)}
                              required
                              minLength={6}
                              className="min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                            />
                          </div>
                        </div>
                        {recoveryError ? <p className="text-sm text-destructive">{recoveryError}</p> : null}
                        <Button type="submit" disabled={recoverySaving} className="w-full gap-2">
                          <KeyRound className="h-4 w-4" />
                          {recoverySaving ? "A guardar…" : "Guardar nova senha"}
                        </Button>
                      </form>
                    )}
                  </CardContent>
                </>
              ) : (
                <>
                  <CardHeader className="px-4 pb-2 pt-4">
                    <CardTitle className="text-xl">{loginConfig?.form_titulo ?? "Faça seu login"}</CardTitle>
                    <p className="text-xs text-muted-foreground">{loginConfig?.form_legenda ?? ""}</p>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <form onSubmit={handleLogin} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="login-user" className="text-xs">Usuario</Label>
                        <div className="flex min-h-10 items-center gap-2 rounded-md border border-input bg-background px-3 shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-0">
                          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          <Input
                            id="login-user"
                            type="email"
                            placeholder={loginConfig?.placeholder_usuario ?? "Email ou usuário"}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="login-pass" className="text-xs">Senha</Label>
                        <div className="flex min-h-10 items-center gap-2 rounded-md border border-input bg-background px-3 shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-0">
                          <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          <Input
                            id="login-pass"
                            type="password"
                            placeholder={loginConfig?.placeholder_senha ?? "Senha"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
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
                        <div className="flex min-h-10 items-center gap-2 rounded-md border border-input bg-background px-3 shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-0">
                          <Key className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          <Input
                            type="text"
                            placeholder={loginConfig?.placeholder_captcha ?? "Digite o código acima"}
                            value={captchaInput}
                            onChange={(e) => setCaptchaInput(e.target.value)}
                            required
                            className="min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </div>
                      </div>

                      <div className="text-right leading-none">
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => {
                            setForgotEmail(email.trim());
                            setForgotOpen(true);
                          }}
                        >
                          {loginConfig?.texto_esqueci_senha ?? "Esqueci minha senha"}
                        </button>
                      </div>

                      {error ? <p className="text-sm text-destructive">{error}</p> : null}

                      <Button type="submit" disabled={loading} className="w-full gap-2">
                        <LogIn className="h-4 w-4" />
                        {loading ? "Entrando..." : loginConfig?.texto_botao_login ?? "Iniciar sessão"}
                      </Button>
                    </form>
                  </CardContent>
                </>
              )}
            </Card>

            <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Recuperar senha</DialogTitle>
                  <DialogDescription>
                    Enviaremos um e-mail com um link seguro de volta para esta página. No Supabase, inclua o
                    URL da app (ex.: <code className="text-xs">https://seu-dominio.com/login</code>) em Redirect
                    URLs.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleForgotSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email" className="text-xs">
                      E-mail da conta
                    </Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="nome@exemplo.com"
                      required
                    />
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button type="button" variant="outline" onClick={() => setForgotOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={forgotSending}>
                      {forgotSending ? "A enviar…" : "Enviar e-mail"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {!passwordRecovery ? (
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
            ) : null}
          </div>

          <footer className="mt-3 text-center text-[11px] text-muted-foreground">{loginConfig?.rodape_texto ?? ""}</footer>
        </div>
      </section>
    </div>
  );
};

export default Login;
