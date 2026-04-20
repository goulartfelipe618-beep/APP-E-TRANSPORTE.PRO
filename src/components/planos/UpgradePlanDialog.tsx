import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { PLAN_LABELS } from "@/hooks/useUserPlan";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Arte oficial FREE vs PRÓ (ficheiro em `public/planos/plano-pro-comparacao.png`). */
const PLANO_COMPARACAO_SRC = "/planos/plano-pro-comparacao.png";

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

  const handleMigrar = () => {
    toast.info("Em breve um dos administradores entrará em contato para alterar o seu plano.");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[min(94vh,920px)] w-[min(100vw-1rem,min(92vw,560px))] max-w-[min(100vw-1rem,min(92vw,560px))] gap-0 overflow-hidden p-0 sm:rounded-xl",
          "border-neutral-800 bg-neutral-950",
          "[&>button]:z-20 [&>button]:text-white [&>button]:opacity-90 [&>button]:hover:opacity-100",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Plano PRÓ — comparação FREE e PRÓ</DialogTitle>
          <DialogDescription>
            Funcionalidade disponível no plano PRÓ. Imagem comparativa dos benefícios FREE e PRÓ.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(72vh,720px)] overflow-y-auto overflow-x-hidden bg-neutral-950">
          <img
            src={PLANO_COMPARACAO_SRC}
            alt="Comparação Plano FREE e Plano PRÓ: benefícios, preços R$ 0,00 e R$ 49,90, e nota sobre ferramentas BETA."
            className="block h-auto w-full max-w-full object-top object-contain"
            loading="eager"
            decoding="async"
          />
        </div>

        <div className="space-y-3 border-t border-neutral-800 bg-neutral-950 px-4 py-4 sm:px-6 sm:py-5">
          <p className="text-center text-xs text-neutral-400">
            Se o PRÓ terminar, os seus dados na plataforma não são apagados — apenas o acesso às funções premium fica suspenso até renovar.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
            <Button
              type="button"
              className="w-full bg-[#FF6600] font-semibold text-white hover:bg-[#e65c00] sm:min-w-[220px] sm:flex-1"
              onClick={handleMigrar}
            >
              Migrar para o plano PRÓ
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full border-neutral-600 bg-transparent font-semibold uppercase tracking-wide text-white hover:bg-white/10 sm:min-w-[140px]"
              onClick={() => onOpenChange(false)}
            >
              FECHAR
            </Button>
          </div>
          {selfServiceUpgrade ? (
            <div className="border-t border-neutral-800 pt-3">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={submitting}
                onClick={() => void runSelfUpgrade()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirmando…
                  </>
                ) : (
                  "Confirmar plano PRÓ no painel (pré-cadastro)"
                )}
              </Button>
              <p className="mt-1 text-center text-[11px] text-neutral-500">
                Passa a constar como cliente com plano PRÓ e sai da fila de pré-cadastro do site, se houver.
              </p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
