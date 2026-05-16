import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getPostLoginPath } from "@/lib/sessionRole";
import {
  getVerifiedTotpFactorId,
  jwtAuthenticatorAssuranceLevel,
  sessionRequiresMfaTotpChallenge,
} from "@/lib/mfaGate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";

export default function MfaChallengePage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState<string>("");
  const [verifying, setVerifying] = useState(false);
  const [fatalMessage, setFatalMessage] = useState<string | null>(null);

  const codeSlots = useMemo(() => Array.from({ length: 6 }, (_, i) => i), []);

  async function redirectByRole() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login", { replace: true });
      return;
    }

    const path = await getPostLoginPath(session.user.id, session.user);
    navigate(path, { replace: true });
  }

  const signOutAndLogin = async (message?: string) => {
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    if (message) toast.error(message);
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    const run = async () => {
      setFatalMessage(null);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          navigate("/login", { replace: true });
          return;
        }

        if (jwtAuthenticatorAssuranceLevel(session.access_token) === "aal2") {
          await redirectByRole();
          return;
        }

        const needChallenge = await sessionRequiresMfaTotpChallenge(supabase);
        if (!needChallenge) {
          await redirectByRole();
          return;
        }

        const verifiedId = await getVerifiedTotpFactorId(supabase);
        if (!verifiedId) {
          setFatalMessage(
            "A sua conta está marcada para 2FA, mas não foi encontrado um autenticador válido. Termine a sessão e contacte o suporte, ou volte a configurar o 2FA após entrar por outro meio.",
          );
          setLoading(false);
          return;
        }

        setFactorId(verifiedId);
        setLoading(false);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Falha ao preparar o desafio 2FA.";
        setError(message);
        setLoading(false);
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = async () => {
    if (!factorId) return;
    if (verifyCode.trim().length !== 6) {
      setError("Digite o código completo (6 dígitos).");
      return;
    }

    setError("");
    setVerifying(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const challengeId = challenge.data.id;

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: verifyCode.trim(),
      });
      if (verify.error) throw verify.error;

      toast.success("2FA verificado com sucesso.");
      await supabase.auth.refreshSession();

      const stillNeeds = await sessionRequiresMfaTotpChallenge(supabase);
      if (stillNeeds) {
        throw new Error("A sessão não foi elevada a AAL2. Atualize a página ou termine a sessão e entre de novo.");
      }

      await redirectByRole();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Código inválido. Tente novamente.";
      setError(message);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">A preparar verificação em dois fatores…</p>
        </div>
      </div>
    );
  }

  if (fatalMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Dialog open>
          <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>2FA — intervenção necessária</DialogTitle>
              <DialogDescription className="text-left text-muted-foreground">{fatalMessage}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button type="button" variant="outline" className="w-full" onClick={() => void signOutAndLogin()}>
                <LogOut className="mr-2 h-4 w-4" />
                Terminar sessão
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Dialog open>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-foreground" />
              <DialogTitle>Autenticação em 2 fatores</DialogTitle>
            </div>
            <DialogDescription>
              Cada conta tem o seu próprio segredo TOTP. Abra a aplicação autenticadora associada a{" "}
              <strong className="text-foreground">esta</strong> sessão e introduza o código de 6 dígitos. Não é possível
              aceder ao painel sem este passo enquanto o 2FA estiver ativo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Código TOTP (6 dígitos)</Label>
              <InputOTP maxLength={6} value={verifyCode} onChange={(v) => setVerifyCode(v)} aria-label="Código 2FA">
                <InputOTPGroup>
                  {codeSlots.map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button
              type="button"
              onClick={() => void handleVerify()}
              disabled={!factorId || verifying}
              className="w-full bg-[#FF6600] text-white hover:bg-[#e65c00]"
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A verificar…
                </>
              ) : (
                "Verificar e continuar"
              )}
            </Button>
            <Button type="button" variant="outline" className="w-full" disabled={verifying} onClick={() => void signOutAndLogin()}>
              <LogOut className="mr-2 h-4 w-4" />
              Terminar sessão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
