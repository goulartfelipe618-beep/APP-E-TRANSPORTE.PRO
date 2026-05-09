import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Lock } from "lucide-react";
import UpgradePlanDialog from "@/components/planos/UpgradePlanDialog";
import type { PlanType } from "@/lib/painelPlanPolicy";
import { planMeetsMinimum } from "@/lib/painelPlanPolicy";

interface PlanLockedScreenProps {
  /** Plano atual do utilizador (normalizado). */
  plano: PlanType;
  /** Plano mínimo necessário para desbloquear. */
  required: "standart" | "pro";
  /** Título curto da área (ex.: «Solicitações — Transfer»). */
  title: string;
  description: string;
}

export default function PlanLockedScreen({ plano, required, title, description }: PlanLockedScreenProps) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const shortfall =
    required === "pro"
      ? "Esta função faz parte do plano PRÓ. Faça upgrade ou fale com o suporte para ativar o PRÓ na sua conta."
      : "Esta função faz parte do plano STANDART ou superior (contratos e campanhas de marketing).";

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-6">
      <Card className="border-border bg-card">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="h-5 w-5 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wide">Plano necessário</span>
          </div>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Crown className="h-6 w-6 text-[#FF6600]" />
            {title}
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground">{shortfall}</p>
          {!planMeetsMinimum(plano, required) ? (
            <Button
              type="button"
              className="w-full bg-[#FF6600] font-semibold text-white hover:bg-[#e65c00]"
              onClick={() => setUpgradeOpen(true)}
            >
              Ver planos e pedir upgrade
            </Button>
          ) : null}
        </CardContent>
      </Card>
      <UpgradePlanDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
