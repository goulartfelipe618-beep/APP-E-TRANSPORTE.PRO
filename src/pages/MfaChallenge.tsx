import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getPostLoginPath } from "@/lib/sessionRole";
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

type Assurance = {
  currentLevel: string;
  nextLevel: string;
};

export default function MfaChallengePage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState<string>("");
  const [verifying, setVerifying] = useState(false);

  const codeSlots = useMemo(() => Array.from({ length: 6 }, (_, i) => i), []);

  async function redirectByRole() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login", { replace: true });
      return;
    }

    const path = await getPostLoginPath(session.user.id);
    navigate(path, { replace: true });
  }

  useEffect(() => {
    const run = async () => {
      try {
        const { data: assurance, error: assuranceErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel() as {
          data: Assurance;
          error: { message: string } | null;
        };

        if (assuranceErr) {
          // Se falhar a verificação de AAL, não travamos o usuário.
          toast.error(assuranceErr.message || "Falha ao verificar 2FA.");
          setLoading(false);
          return;
        }

        const needsMfa = assurance.nextLevel === "aal2" && assurance.currentLevel !== "aal2";
        if (!needsMfa) {
          await redirectByRole();
          return;
        }

        const factors = await supabase.auth.mfa.listFactors();
        if (factors.error) {
          throw factors.error;
        }

        const totpFactor = factors.data?.totp?.[0];
        if (!totpFactor?.id) {
          toast.error("Nenhum fator TOTP encontrado para esta conta.");
          navigate("/dashboard", { replace: true });
          return;
        }

        setFactorId(totpFactor.id);
        setLoading(false);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Falha ao iniciar o desafio 2FA.";
        setError(message);
        setLoading(false);
      }
    };

    run();
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
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando 2FA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Dialog open>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-foreground" />
              <DialogTitle>Autenticação em 2 Fatores</DialogTitle>
            </div>
            <DialogDescription>
              Abra seu app autenticador e informe o código do TOTP.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Senha de verificação (TOTP)</Label>
              <InputOTP
                maxLength={6}
                value={verifyCode}
                onChange={(v) => setVerifyCode(v)}
                aria-label="Código 2FA"
              >
                <InputOTPGroup>
                  {codeSlots.map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              onClick={handleVerify}
              disabled={!factorId || verifying}
              className="bg-primary text-primary-foreground"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Verificar 2FA"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

