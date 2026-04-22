import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { applyThemeForRoute } from "@/lib/panelTheme";
import { Loader2 } from "lucide-react";

function validatePortalPassword(password: string): string | null {
  if (password.length < 12) return "A senha deve ter pelo menos 12 caracteres.";
  if (password.length > 128) return "Senha demasiado longa.";
  if (!/[a-z]/.test(password)) return "Inclua pelo menos uma letra minúscula.";
  if (!/[A-Z]/.test(password)) return "Inclua pelo menos uma letra maiúscula.";
  if (!/[0-9]/.test(password)) return "Inclua pelo menos um número.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Inclua pelo menos um símbolo (ex.: ! @ # ?).";
  return null;
}

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("invalid_grant")) {
    return "Senha incorreta. Verifique e tente novamente.";
  }
  return message;
}

export default function MotoristaFrotaAcessoPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [registered, setRegistered] = useState(false);
  const [loginEmail, setLoginEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "robots");
    meta.setAttribute("content", "noindex, nofollow, noarchive");
    meta.setAttribute("data-frota-acesso", "1");
    document.head.appendChild(meta);
    return () => {
      document.querySelector('meta[data-frota-acesso="1"]')?.remove();
    };
  }, []);

  useEffect(() => {
    void (async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke<{
        nome?: string;
        registered?: boolean;
        login_email?: string | null;
        error?: string;
      }>("motorista-frota-portal", {
        method: "POST",
        body: { action: "status", token },
      });
      setLoading(false);
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Link inválido.");
        return;
      }
      setNome(data?.nome ?? "");
      setRegistered(!!data?.registered);
      setLoginEmail(data?.login_email ?? null);
    })();
  }, [token]);

  const handleBootstrap = async () => {
    if (!token) return;
    const pwErr = validatePortalPassword(password);
    if (pwErr) {
      toast.error(pwErr);
      return;
    }
    if (password !== password2) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ email?: string; error?: string }>("motorista-frota-portal", {
        method: "POST",
        body: { action: "bootstrap", token, password },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Erro ao criar conta.");
        return;
      }
      const email = data?.email;
      if (!email) {
        toast.error("Resposta inválida do servidor.");
        return;
      }
      const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
      if (sErr) {
        toast.error(mapAuthError(sErr.message));
        return;
      }
      const { data: s } = await supabase.auth.getSession();
      if (s.session?.user) applyThemeForRoute("/frota", s.session.user.id);
      toast.success("Conta criada. Bem-vindo!");
      navigate("/frota", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async () => {
    if (!loginPass.trim()) {
      toast.error("Introduza a sua senha.");
      return;
    }
    if (!loginEmail?.trim()) {
      toast.error("A preparar o acesso… Se persistir, recarregue a página.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPass,
      });
      if (error) {
        toast.error(mapAuthError(error.message));
        return;
      }
      const { data: s } = await supabase.auth.getSession();
      if (s.session?.user) applyThemeForRoute("/frota", s.session.user.id);
      navigate("/frota", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-background px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-background p-4">
        <p className="text-sm text-muted-foreground">Link inválido.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-muted/30 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Portal do motorista</CardTitle>
          <p className="text-sm text-muted-foreground">
            {nome ? (
              <>
                Olá, <strong className="text-foreground">{nome}</strong>. O acesso está associado a este link — só precisa da senha.
              </>
            ) : (
              "Acesso à área do motorista."
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!registered ? (
            <>
              <p className="text-sm text-muted-foreground">Defina uma senha forte para entrar no painel (Agenda e Reservas).</p>
              <div className="space-y-2">
                <Label htmlFor="pw1">Senha</Label>
                <Input
                  id="pw1"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw2">Confirmar senha</Label>
                <Input
                  id="pw2"
                  type="password"
                  autoComplete="new-password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <Button type="button" className="min-h-11 w-full bg-primary text-primary-foreground" disabled={busy} onClick={() => void handleBootstrap()}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Criar acesso e entrar
              </Button>
            </>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleLogin();
              }}
            >
              <p className="text-sm text-muted-foreground">Introduza a senha que definiu para este acesso.</p>
              {loginEmail ? (
                <input type="text" name="username" autoComplete="username" value={loginEmail} readOnly tabIndex={-1} aria-hidden className="sr-only" />
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="lp">Senha</Label>
                <Input
                  id="lp"
                  type="password"
                  autoComplete="current-password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <Button type="submit" className="min-h-11 w-full bg-primary text-primary-foreground" disabled={busy || !loginEmail}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Entrar
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
