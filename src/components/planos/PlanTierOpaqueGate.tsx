import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanType } from "@/lib/painelPlanPolicy";
import UpgradePlanDialog from "@/components/planos/UpgradePlanDialog";

interface PlanTierOpaqueGateProps {
  /** Plano mínimo da página (`null` = sem bloqueio de tier). */
  minimumPlan: PlanType | null;
  /** Quando true, o conteúdo fica visível mas escurecido e sem interação. */
  blocked: boolean;
  title: string;
  description: string;
  children: React.ReactNode;
}

function tierPhrase(minimumPlan: PlanType): string {
  if (minimumPlan === "pro") return "PRÓ";
  if (minimumPlan === "standart") return "STANDART ou PRÓ";
  return "";
}

/**
 * Mostra o conteúdo real da página (dados não são removidos) com opacidade e sem cliques
 * quando o plano atual não cumpre o mínimo; faixa fixa no topo com CTA de upgrade.
 */
export default function PlanTierOpaqueGate({
  minimumPlan,
  blocked,
  title,
  description,
  children,
}: PlanTierOpaqueGateProps) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  if (!minimumPlan) {
    return <>{children}</>;
  }
  const gated = blocked;

  return (
    <div className="relative">
      {gated ? (
        <div
          role="status"
          className="sticky top-0 z-20 mb-4 flex flex-col gap-3 rounded-lg border border-[#FF6600]/35 bg-background/95 p-4 shadow-md backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[#FF6600]" aria-hidden />
            <div className="min-w-0 space-y-1">
              <p className="font-semibold text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
              <p className="text-sm text-muted-foreground">
                Os seus dados mantêm-se guardados — nada é apagado por mudança de plano. Com{" "}
                <span className="font-medium text-foreground">{tierPhrase(minimumPlan)}</span> volta a editar e a usar
                esta área sem restrições.
              </p>
            </div>
          </div>
          <Button
            type="button"
            className="h-10 shrink-0 bg-[#FF6600] font-semibold text-white hover:bg-[#e65c00]"
            onClick={() => setUpgradeOpen(true)}
          >
            Ver planos
          </Button>
        </div>
      ) : null}
      <div
        className={cn(
          "transition-[opacity,filter] duration-200",
          gated && "pointer-events-none select-none opacity-[0.4] saturate-[0.65]",
        )}
      >
        {children}
      </div>
      {gated ? <UpgradePlanDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} emphasizePaidTiers /> : null}
    </div>
  );
}
