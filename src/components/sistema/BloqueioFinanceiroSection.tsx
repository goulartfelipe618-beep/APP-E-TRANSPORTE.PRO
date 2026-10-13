import { useState } from "react";
import { Loader2, Lock, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useConfiguracoes } from "@/contexts/ConfiguracoesContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function qrParaImagem(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.startsWith("data:") || /^https?:\/\//i.test(t)) return t;
  if (t.startsWith("<svg")) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(t)}`;
  return `data:image/png;base64,${t}`;
}

async function validarCodigo(codigo: string): Promise<void> {
  const code = codigo.trim();
  if (!/^\d{6}$/.test(code)) throw new Error("Digite o código de 6 dígitos.");
  const list = await supabase.auth.mfa.listFactors();
  if (list.error) throw list.error;
  const factor = (list.data?.totp ?? []).find((f) => f.status === "verified");
  if (!factor) throw new Error("Ative o autenticador antes de continuar.");
  const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (challenge.error || !challenge.data) throw challenge.error ?? new Error("Não foi possível validar o código.");
  const verify = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.data.id, code });
  if (verify.error) throw new Error("Código inválido.");
  await supabase.auth.refreshSession();
}

export default function BloqueioFinanceiroSection() {
  const { config, refreshConfig } = useConfiguracoes();
  const bloqueado = config.financeiro_bloqueado === true;
  const [aberto, setAberto] = useState(false);
  const [bloquear, setBloquear] = useState(true);
  const [passo, setPasso] = useState<"confirma" | "qr" | "codigo">("confirma");
  const [codigo, setCodigo] = useState("");
  const [qr, setQr] = useState("");
  const [segredo, setSegredo] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const fechar = () => {
    if (factorId && passo === "qr") {
      void supabase.auth.mfa.unenroll({ factorId }).catch(() => undefined);
    }
    setAberto(false);
    setCodigo("");
    setQr("");
    setSegredo("");
    setFactorId(null);
    setOcupado(false);
  };

  const abrir = async (acaoBloquear: boolean) => {
    setBloquear(acaoBloquear);
    setCodigo("");
    setQr("");
    setSegredo("");
    setFactorId(null);
    setPasso("confirma");
    setAberto(true);
  };

  const seguirParaCodigo = async () => {
    setOcupado(true);
    try {
      const list = await supabase.auth.mfa.listFactors();
      if (list.error) throw list.error;
      const verificado = (list.data?.totp ?? []).find((f) => f.status === "verified");
      if (verificado) {
        setPasso("codigo");
        return;
      }
      for (const fator of list.data?.totp ?? []) {
        if (fator.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: fator.id });
      }
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email?.trim() || "conta";
      const enroll = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "E-Transporte.pro",
        friendlyName: `Painel · ${email} · ${Date.now().toString(36)}`,
      });
      if (enroll.error || !enroll.data) throw enroll.error ?? new Error("Não foi possível gerar o autenticador.");
      setFactorId(enroll.data.id);
      setQr(qrParaImagem(enroll.data.totp.qr_code));
      setSegredo(enroll.data.totp.secret);
      setPasso("qr");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível preparar o autenticador.");
    } finally {
      setOcupado(false);
    }
  };

  const confirmar = async () => {
    setOcupado(true);
    try {
      if (passo === "qr") {
        if (!factorId) throw new Error("Gere o QR do autenticador de novo.");
        const code = codigo.trim();
        if (!/^\d{6}$/.test(code)) throw new Error("Digite o código de 6 dígitos.");
        const challenge = await supabase.auth.mfa.challenge({ factorId });
        if (challenge.error || !challenge.data) throw challenge.error ?? new Error("Não foi possível validar o código.");
        const verify = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
        if (verify.error) throw new Error("Código inválido.");
        await supabase.auth.refreshSession();
        setFactorId(null);
      } else {
        await validarCodigo(codigo);
      }
      const { error } = await supabase.rpc("definir_bloqueio_financeiro", { p_bloquear: bloquear });
      if (error) throw error;
      await refreshConfig();
      window.dispatchEvent(new Event("configuracoes-updated"));
      window.dispatchEvent(new Event("mfa-atualizado"));
      toast.success(bloquear ? "Menu Financeiro bloqueado. O login desta conta passa a exigir o autenticador." : "Menu Financeiro liberado.");
      setFactorId(null);
      setAberto(false);
      setCodigo("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="max-w-2xl rounded-xl border border-border bg-card p-6">
      <div className="mb-1 flex items-center gap-2">
        <Lock className="h-5 w-5 text-foreground" />
        <h3 className="font-semibold text-foreground">Acesso de funcionários</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Quem usa o mesmo login deixa de ver o menu Financeiro, o dashboard e os relatórios. Bloquear e desbloquear pede o código do autenticador. A partir do bloqueio, entrar na conta também exige esse código.
      </p>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
        <div className="space-y-1">
          <p className="font-medium text-foreground">Menu Financeiro</p>
          <Badge variant="outline">{bloqueado ? "Bloqueado" : "Visível"}</Badge>
        </div>
        {bloqueado ? (
          <Button type="button" variant="outline" onClick={() => void abrir(false)}>
            Desbloquear
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={() => void abrir(true)}>
            Bloquear
          </Button>
        )}
      </div>

      <Dialog open={aberto} onOpenChange={(open) => (open ? setAberto(true) : fechar())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{bloquear ? "Bloquear o Financeiro" : "Desbloquear o Financeiro"}</DialogTitle>
            <DialogDescription>
              {passo === "confirma"
                ? bloquear
                  ? "O menu, o dashboard e os relatórios financeiros somem deste painel até alguém desbloquear com o autenticador."
                  : "O menu Financeiro e os relatórios voltam a aparecer neste painel."
                : "Digite o código de 6 dígitos do aplicativo autenticador desta conta."}
            </DialogDescription>
          </DialogHeader>

          {passo === "qr" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Esta conta ainda não tem autenticador. Escaneie o QR. Depois disso, todo login pede esse código.
              </p>
              {qr ? (
                <div className="flex justify-center rounded-lg border border-border bg-white p-3">
                  <img src={qr} alt="QR do autenticador" className="h-44 w-44 object-contain" />
                </div>
              ) : null}
              {segredo ? <p className="break-all text-xs text-muted-foreground">Secret: <span className="text-foreground">{segredo}</span></p> : null}
            </div>
          ) : null}

          {passo !== "confirma" ? (
            <div className="space-y-2">
              <Label>Código do autenticador</Label>
              <InputOTP maxLength={6} value={codigo} onChange={setCodigo}>
                <InputOTPGroup>
                  {Array.from({ length: 6 }, (_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={fechar} disabled={ocupado}>
              Cancelar
            </Button>
            {passo === "confirma" ? (
              <Button type="button" onClick={() => void seguirParaCodigo()} disabled={ocupado}>
                {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                Sim, {bloquear ? "bloquear" : "desbloquear"}
              </Button>
            ) : (
              <Button type="button" onClick={() => void confirmar()} disabled={ocupado || codigo.trim().length !== 6}>
                {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirmar código
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
