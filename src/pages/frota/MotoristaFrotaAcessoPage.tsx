import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { applyThemeForRoute } from "@/lib/panelTheme";
import { clearDashboardNavSessionStorage } from "@/lib/motoristaFrotaRole";
import { claimExclusiveSession } from "@/lib/sessionRevocation";
import {
  aplicativoEhDoMotorista,
  lembrarTokenAplicativoMotorista,
  limparTokenAplicativoMotorista,
} from "@/lib/capacitorFrota";
import {
  confirmarEntradaPeloLinkUnico,
  entrarNoMiniPainelComoDono,
  limparEntradaPeloLinkUnico,
  limparPreviewDoDono,
  loginDoMotoristaTrocaraOutraConta,
} from "@/lib/motoristaPortalEntrada";
import { validateMotoristaPortalPassword } from "@/lib/motoristaPortalPassword";
import { Loader2 } from "lucide-react";

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("invalid_grant")) {
    return "Senha incorreta. Verifique e tente novamente.";
  }
  return message;
}

function parsePortalProOnlyFromFunctionsError(
  error: unknown,
  data: unknown,
): string | null {
  const d = data as { error?: string; message?: string } | null | undefined;
  if (d?.error === "portal_pro_only") {
    return d.message || "Este link só está ativo com o plano PRÓ na conta da frota.";
  }
  const errObj = error as { context?: { body?: unknown } } | null;
  const body = errObj?.context?.body;
  if (typeof body === "string") {
    try {
      const j = JSON.parse(body) as { error?: string; message?: string };
      if (j.error === "portal_pro_only") {
        return j.message || "Este link só está ativo com o plano PRÓ na conta da frota.";
      }
    } catch {
      /* noop */
    }
  }
  if (body && typeof body === "object" && body !== null && "error" in body) {
    const j = body as { error?: string; message?: string };
    if (j.error === "portal_pro_only") {
      return j.message || "Este link só está ativo com o plano PRÓ na conta da frota.";
    }
  }
  return null;
}

export default function MotoristaFrotaAcessoPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [planBlockedMessage, setPlanBlockedMessage] = useState<string | null>(null);
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
      setPlanBlockedMessage(null);
      if (!token) {
        setLoading(false);
        return;
      }
      lembrarTokenAplicativoMotorista(token);
      try {
        const preview = await entrarNoMiniPainelComoDono(token);
        if (preview) {
          navigate("/frota", { replace: true });
          return;
        }
      } catch {
        /* a sessão do painel fica; o formulário do motorista segue abaixo */
      }
      const { data, error } = await supabase.functions.invoke<{
        nome?: string;
        registered?: boolean;
        login_email?: string | null;
        error?: string;
        message?: string;
      }>("motorista-frota-portal", {
        method: "POST",
        body: { action: "status", token },
      });

      const blocked = parsePortalProOnlyFromFunctionsError(error, data);
      if (blocked) {
        setPlanBlockedMessage(blocked);
        setLoading(false);
        return;
      }

      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Link inválido.");
        setLoading(false);
        return;
      }
      setNome(data?.nome ?? "");
      setRegistered(!!data?.registered);
      setLoginEmail(data?.login_email ?? null);
      const sessao = await supabase.auth.getSession();
      const emailSessao = sessao.data.session?.user?.email;
      const emailDoLink = data?.login_email ?? "";
      if (emailSessao && emailDoLink && !loginDoMotoristaTrocaraOutraConta(emailSessao, emailDoLink)) {
        const uid = sessao.data.session?.user?.id;
        if (uid && (await confirmarEntradaPeloLinkUnico(uid, token))) {
          navigate("/frota", { replace: true });
          return;
        }
      }
      setLoading(false);
    })();
  }, [token, navigate]);

  const usarOutroMotorista = async () => {
    limparTokenAplicativoMotorista();
    limparEntradaPeloLinkUnico();
    limparPreviewDoDono();
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* só esta instalação */
    }
    navigate("/aplicativo-motorista", { replace: true });
  };

  const handleBootstrap = async () => {
    if (!token) return;
    const pwErr = validateMotoristaPortalPassword(password);
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
      const { data, error } = await supabase.functions.invoke<{ email?: string; error?: string; message?: string }>(
        "motorista-frota-portal",
        {
          method: "POST",
          body: { action: "bootstrap", token, password },
        },
      );
      const blocked = parsePortalProOnlyFromFunctionsError(error, data);
      if (blocked) {
        setPlanBlockedMessage(blocked);
        return;
      }
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Erro ao criar conta.");
        return;
      }
      const email = data?.email;
      if (!email) {
        toast.error("Resposta inválida do servidor.");
        return;
      }
      const atual = await supabase.auth.getSession();
      if (loginDoMotoristaTrocaraOutraConta(atual.data.session?.user?.email, email)) {
        toast.error("O painel já aberto neste navegador foi mantido. Este motorista entra numa janela anônima, ou depois de sair da outra conta.");
        return;
      }
      const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
      if (sErr) {
        toast.error(mapAuthError(sErr.message));
        return;
      }
      if (!(await claimExclusiveSession())) {
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          /* sessão nova não pode ficar sem ser a única */
        }
        toast.error("Não foi possível validar a sessão. Tente entrar de novo.");
        return;
      }
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user?.id;
      if (!uid || !(await confirmarEntradaPeloLinkUnico(uid, token))) {
        limparEntradaPeloLinkUnico();
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          /* sem o link confirmado a sessão não permanece */
        }
        toast.error("Este link não corresponde a esta conta de motorista.");
        return;
      }
      applyThemeForRoute("/frota", uid);
      clearDashboardNavSessionStorage();
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
      const atual = await supabase.auth.getSession();
      if (loginDoMotoristaTrocaraOutraConta(atual.data.session?.user?.email, loginEmail)) {
        toast.error("O painel já aberto neste navegador foi mantido. Este motorista entra numa janela anônima, ou depois de sair da outra conta.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPass,
      });
      if (error) {
        toast.error(mapAuthError(error.message));
        return;
      }
      if (!(await claimExclusiveSession())) {
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          /* sessão nova não pode ficar sem ser a única */
        }
        toast.error("Não foi possível validar a sessão. Tente entrar de novo.");
        return;
      }
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user?.id;
      if (!uid || !(await confirmarEntradaPeloLinkUnico(uid, token))) {
        limparEntradaPeloLinkUnico();
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          /* sem o link confirmado a sessão não permanece */
        }
        toast.error("Este link não corresponde a esta conta de motorista.");
        return;
      }
      applyThemeForRoute("/frota", uid);
      clearDashboardNavSessionStorage();
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

  if (planBlockedMessage) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Acesso temporariamente indisponível</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{planBlockedMessage}</p>
            <p className="text-xs">
              O dono da frota precisa do plano <strong className="text-foreground">PRÓ</strong> para ativar o mini painel do motorista neste link.
            </p>
          </CardContent>
        </Card>
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
              <p className="text-sm text-muted-foreground">
                Defina uma senha forte para entrar no painel (Agenda, Reservas e Documentos). Este link é o único acesso ao mini painel. O login da empresa não abre esta área.
              </p>
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
              <p className="text-sm text-muted-foreground">
                Introduza a senha que definiu para este acesso. Este link é o único jeito de abrir o mini painel.
              </p>
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
          {aplicativoEhDoMotorista() ? (
            <Button type="button" variant="ghost" className="h-11 w-full" onClick={() => void usarOutroMotorista()}>
              Este aplicativo é de outro motorista
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
