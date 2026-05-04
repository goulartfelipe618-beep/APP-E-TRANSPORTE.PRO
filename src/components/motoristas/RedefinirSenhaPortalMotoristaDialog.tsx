import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { validateMotoristaPortalPassword } from "@/lib/motoristaPortalPassword";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `solicitacoes_motoristas.id` — só o dono (`user_id`) pode redefinir na Edge Function. */
  motoristaId: string | null;
  motoristaNome?: string;
}

export default function RedefinirSenhaPortalMotoristaDialog({ open, onOpenChange, motoristaId, motoristaNome }: Props) {
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const resetFields = () => {
    setPw1("");
    setPw2("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetFields();
    onOpenChange(next);
  };

  const submit = async () => {
    if (!motoristaId) return;
    const err = validateMotoristaPortalPassword(pw1);
    if (err) {
      toast.error(err);
      return;
    }
    if (pw1 !== pw2) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ error?: string; message?: string }>(
        "motorista-frota-portal",
        {
          method: "POST",
          body: { action: "reset_portal_password", motorista_id: motoristaId, password: pw1 },
        },
      );
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Não foi possível redefinir a senha.");
        return;
      }
      toast.success(data?.message || "Senha do portal atualizada. Comunique a nova senha ao motorista por um canal seguro.");
      resetFields();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Redefinir senha do portal</DialogTitle>
          <DialogDescription>
            Apenas a sua conta (dono da frota) pode alterar a senha do mini painel deste motorista. O motorista não pode
            fazer esta operação.
            {motoristaNome ? (
              <>
                {" "}
                Motorista: <strong className="text-foreground">{motoristaNome}</strong>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="rpp1">Nova senha</Label>
            <Input
              id="rpp1"
              type="password"
              autoComplete="new-password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              className="min-h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rpp2">Confirmar senha</Label>
            <Input
              id="rpp2"
              type="password"
              autoComplete="new-password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className="min-h-10"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Mínimo 12 caracteres, maiúsculas, minúsculas, número e símbolo — igual à primeira definição no link do portal.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" className="bg-[#FF6600] text-white hover:bg-[#e65c00]" disabled={busy} onClick={() => void submit()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar nova senha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
