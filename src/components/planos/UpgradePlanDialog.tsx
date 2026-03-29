import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Rocket, TrendingUp, Zap } from "lucide-react";
import { PlanType, PLAN_LABELS } from "@/hooks/useUserPlan";

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredPlan: PlanType;
}

const PLAN_ICONS: Record<string, any> = {
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

export default function UpgradePlanDialog({ open, onOpenChange, requiredPlan }: UpgradePlanDialogProps) {
  const Icon = PLAN_ICONS[requiredPlan] || Crown;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            Migrar de plano
          </DialogTitle>
          <DialogDescription>
            Para continuar, é necessário o plano <Badge variant="outline" className="ml-1 font-semibold">{PLAN_LABELS[requiredPlan]}</Badge>
            {requiredPlan === "seed" && " — necessário para concluir a contratação de E-mail Business e demais recursos pagos básicos."}
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
            <p className="text-sm text-muted-foreground">{PLAN_DESCRIPTIONS[requiredPlan] ?? "Entre em contato para mais detalhes."}</p>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Entre em contato com o administrador para fazer o upgrade do seu plano.
          </p>
          <Button className="w-full" onClick={() => {
            const msg = encodeURIComponent(`Olá! Gostaria de fazer upgrade para o plano ${PLAN_LABELS[requiredPlan]}.`);
            window.open(`https://wa.me/?text=${msg}`, "_blank");
            onOpenChange(false);
          }}>
            Solicitar Upgrade via WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
