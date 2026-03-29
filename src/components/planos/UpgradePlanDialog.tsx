import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Crown, Loader2, Rocket, TrendingUp, Zap } from "lucide-react";
import { PlanType, PLAN_LABELS, PLANS_PAID_ORDER, PLAN_ORDER } from "@/hooks/useUserPlan";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredPlan: PlanType;
  /** Usuário em FREE: pode escolher plano pago e aplicar no painel (remove da fila de solicitações do site). */
  selfServiceUpgrade?: boolean;
  onUpgradeSuccess?: () => void;
}

const PLAN_ICONS: Record<string, typeof Crown> = {
  seed: Rocket,
  grow: TrendingUp,
  rise: Zap,
  apex: Crown,
};

const PLAN_DESCRIPTIONS: Partial<Record<PlanType, string>> = {
  free: "Navegue por todos os menus com limitações nos fluxos premium.",
  seed: "Acesso a funcionalidades básicas para iniciar seu negócio.",
  grow: "Inclui ferramentas de disparo e comunicação avançada.",
  rise: "Acesso a websites profissionais e recursos de marketing.",
  apex: "Plano completo com Google Business e todos os recursos premium.",
};

function paidOptionsForRequired(requiredPlan: PlanType): PlanType[] {
  const minIdx = Math.max(PLAN_ORDER.indexOf(requiredPlan), PLAN_ORDER.indexOf("seed"));
  return PLANS_PAID_ORDER.filter((p) => PLAN_ORDER.indexOf(p) >= minIdx);
}

export default function UpgradePlanDialog({
  open,
  onOpenChange,
  requiredPlan,
  selfServiceUpgrade = false,
  onUpgradeSuccess,
}: UpgradePlanDialogProps) {
  const Icon = PLAN_ICONS[requiredPlan] || Crown;
  const options = paidOptionsForRequired(requiredPlan);
  const [chosen, setChosen] = useState<PlanType>("seed");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const o = paidOptionsForRequired(requiredPlan);
      if (o.length > 0) setChosen(o[0]);
    }
  }, [open, requiredPlan]);

  const runSelfUpgrade = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("self-upgrade-plan", {
        body: { plano: chosen },
      });
      if (error) {
        toast.error(error.message || "Erro ao atualizar plano");
        return;
      }
      if (data && typeof data === "object" && "error" in data && data.error) {
        toast.error(String(data.error));
        return;
      }
      toast.success(`Plano atualizado para ${PLAN_LABELS[chosen]}`);
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
            <Icon className="h-5 w-5 text-primary" />
            Migrar de plano
          </DialogTitle>
          <DialogDescription>
            Para continuar, é necessário o plano{" "}
            <Badge variant="outline" className="ml-1 font-semibold">
              {PLAN_LABELS[requiredPlan]}
            </Badge>
            {requiredPlan === "seed" &&
              " — necessário para concluir a contratação de E-mail Business e demais recursos pagos básicos."}
            {requiredPlan === "rise" && " — inclui fluxo completo de website após o domínio."}
            {requiredPlan === "grow" && " — libera o disparador de mensagens."}
            {requiredPlan === "apex" && " — libera criação e gestão do perfil no Google."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Plano {PLAN_LABELS[requiredPlan]}</h3>
            <p className="text-sm text-muted-foreground">
              {PLAN_DESCRIPTIONS[requiredPlan] ?? "Entre em contato para mais detalhes."}
            </p>
          </div>

          {selfServiceUpgrade && options.length > 0 && (
            <div className="space-y-2">
              <Label>Escolha o plano</Label>
              <Select value={chosen} onValueChange={(v) => setChosen(v as PlanType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PLAN_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="w-full" disabled={submitting} onClick={() => void runSelfUpgrade()}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirmando…
                  </>
                ) : (
                  "Confirmar plano no painel"
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Você será cadastrado como cliente com o plano escolhido e sairá da fila de pré-cadastro do site, se houver.
              </p>
            </div>
          )}

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              {selfServiceUpgrade
                ? "Prefere falar com o administrador?"
                : "Entre em contato com o administrador para fazer o upgrade do seu plano."}
            </p>
            <Button
              variant={selfServiceUpgrade ? "outline" : "default"}
              className="w-full"
              onClick={() => {
                const msg = encodeURIComponent(
                  `Olá! Gostaria de fazer upgrade para o plano ${PLAN_LABELS[requiredPlan]}.`,
                );
                window.open(`https://wa.me/?text=${msg}`, "_blank");
                onOpenChange(false);
              }}
            >
              Solicitar via WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
