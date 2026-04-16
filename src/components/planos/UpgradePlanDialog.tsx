import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Loader2 } from "lucide-react";
import { PLAN_LABELS } from "@/hooks/useUserPlan";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Utilizador em FREE: pode confirmar plano PRÓ no painel (remove da fila de solicitações do site, se aplicável). */
  selfServiceUpgrade?: boolean;
  onUpgradeSuccess?: () => void;
}

export default function UpgradePlanDialog({
  open,
  onOpenChange,
  selfServiceUpgrade = false,
  onUpgradeSuccess,
}: UpgradePlanDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) setSubmitting(false);
  }, [open]);

  const runSelfUpgrade = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("self-upgrade-plan", {
        body: { plano: "pro" },
      });
      if (error) {
        toast.error(error.message || "Erro ao atualizar plano");
        return;
      }
      if (data && typeof data === "object" && "error" in data && data.error) {
        toast.error(String(data.error));
        return;
      }
      toast.success(`Plano atualizado para ${PLAN_LABELS.pro}`);
      onUpgradeSuccess?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar plano");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Plano PRÓ
          </DialogTitle>
          <DialogDescription>
            Para continuar, é necessário o plano{" "}
            <Badge variant="outline" className="ml-1 font-semibold">
              {PLAN_LABELS.pro}
            </Badge>
            {" — "}acesso completo às ferramentas avançadas do painel (campanhas, domínios, website, Google, Network,
            automações, entre outras).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Crown className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Plano {PLAN_LABELS.pro}</h3>
            <p className="text-sm text-muted-foreground">
              Um único plano pago com todos os recursos premium do motorista executivo.
            </p>
          </div>

          {selfServiceUpgrade && (
            <div className="space-y-2">
              <Button className="w-full" disabled={submitting} onClick={() => void runSelfUpgrade()}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirmando…
                  </>
                ) : (
                  "Confirmar plano PRÓ no painel"
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Passa a constar como cliente com plano PRÓ e sai da fila de pré-cadastro do site, se houver.
              </p>
            </div>
          )}

          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-center text-sm text-muted-foreground">
              {selfServiceUpgrade
                ? "Prefere falar com o administrador?"
                : "Entre em contato com o administrador para ativar o plano PRÓ."}
            </p>
            <Button
              variant={selfServiceUpgrade ? "outline" : "default"}
              className="w-full"
              onClick={() => {
                toast.message("Contato pelo painel", {
                  description:
                    "Para ativar o plano PRÓ, use o menu Tickets ou fale com o administrador pelos canais oficiais do sistema.",
                });
                onOpenChange(false);
              }}
            >
              Solicitar contato
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
