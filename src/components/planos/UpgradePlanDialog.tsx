import { useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { PLAN_LABELS } from "@/hooks/useUserPlan";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Utilizador em FREE: pode confirmar plano PRÓ no painel (remove da fila de solicitações do site, se aplicável). */
  selfServiceUpgrade?: boolean;
  onUpgradeSuccess?: () => void;
}

const FREE_FEATURES = [
  "Painel de Abrangência",
  "Métricas detalhadas",
  "Gestão de Transfers",
  "Reservas em PDF",
  "Edição de Contrato",
  "Cadastro de motorista",
  "Cadastro de veículos",
  "Mentoria Completa",
  "Geolocalizador Ao Vivo",
  "Campanhas",
  "Receptivos e QR Codes",
  "Network",
  "Comunicador",
  "Disparador",
] as const;

const PRO_FEATURES = [
  "Todas as ferramentas FREE",
  "Receba um E-mail profissional: (contato@seudominio.com.br)",
  "Receba um website Completo: Receba reservas pelo website",
  "Receba um domínio Oficial: www.seudominio.com.br",
  "Receba um Catálogo em PDF: Criado automaticamente",
  "Configure Automações: Receba solicitações externas",
  "Google Business Profile: Adicione sua empresa no Maps",
] as const;

function FeatureRow({ children, variant }: { children: ReactNode; variant: "free" | "pro" }) {
  return (
    <li className="flex gap-2 text-left text-[13px] leading-snug">
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          variant === "free"
            ? "bg-amber-500/90 text-neutral-900"
            : "border border-white/40 bg-white/10 text-white",
        )}
        aria-hidden
      >
        <Check className="h-3 w-3 stroke-[3]" />
      </span>
      <span className={variant === "pro" ? "text-white" : "text-neutral-900"}>{children}</span>
    </li>
  );
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
          "max-h-[min(92vh,900px)] w-[min(100vw-1rem,920px)] max-w-[min(100vw-1rem,920px)] gap-0 overflow-hidden p-0 sm:rounded-xl",
          "border-neutral-800 bg-neutral-950",
          "[&>button]:text-white [&>button]:opacity-90 [&>button]:hover:opacity-100",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Plano PRÓ — comparação FREE e PRÓ</DialogTitle>
          <DialogDescription>
            Funcionalidade disponível no plano PRÓ. Compare benefícios e migre quando desejar.
          </DialogDescription>
        </DialogHeader>
        <div className="border-b border-black bg-neutral-950 px-4 pb-4 pt-5 pr-12 text-center sm:px-8 sm:pt-6">
          <h2 className="text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">Plano PRÓ</h2>
          <p className="mt-2 text-sm text-white/90 sm:text-base">
            Conheça agora todos os benefícios ao aderir ao plano PRÓ
          </p>
        </div>

        <div className="grid max-h-[min(52vh,480px)] grid-cols-1 overflow-y-auto border-b border-black md:grid-cols-2 md:max-h-none md:overflow-visible">
          {/* FREE */}
          <div className="flex flex-col border-b border-black bg-white md:border-b-0 md:border-r">
            <div className="border-b border-neutral-200 px-4 py-4 sm:px-5">
              <h3 className="text-lg font-bold text-neutral-900">Plano FREE</h3>
              <p className="mt-2 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                Plano limitado da plataforma, disponibilizando apenas ferramentas básicas.
              </p>
              <p className="mt-3 text-2xl font-bold tabular-nums text-neutral-900 sm:text-3xl">R$ 0,00</p>
            </div>
            <ul className="flex flex-1 flex-col gap-2.5 px-4 py-4 sm:px-5 sm:py-5">
              {FREE_FEATURES.map((line) => (
                <FeatureRow key={line} variant="free">
                  {line}
                </FeatureRow>
              ))}
            </ul>
          </div>

          {/* PRÓ */}
          <div
            className="flex flex-col"
            style={{
              background: "linear-gradient(165deg, #c9a227 0%, #a67c00 45%, #7a5c00 100%)",
            }}
          >
            <div className="border-b border-black/20 px-4 py-4 sm:px-5">
              <h3 className="text-lg font-bold text-white">Plano PRÓ</h3>
              <p className="mt-2 text-xs leading-relaxed text-white/95 sm:text-sm">
                Plano completo da plataforma, disponibilizando todas as ferramentas.
              </p>
              <p className="mt-3 text-2xl font-bold tabular-nums text-white sm:text-3xl">R$ 49,90</p>
            </div>
            <ul className="flex flex-1 flex-col gap-2.5 px-4 py-4 sm:px-5 sm:py-5">
              {PRO_FEATURES.map((line) => (
                <FeatureRow key={line} variant="pro">
                  {line}
                </FeatureRow>
              ))}
            </ul>
            <div className="mx-4 mb-4 rounded-md border border-black/40 bg-black px-3 py-2.5 sm:mx-5">
              <p className="text-center text-[11px] leading-snug text-white sm:text-xs">
                Ferramentas BETA, NÃO possuem garantia pois dependem de sistemas externos.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 bg-neutral-950 px-4 py-4 sm:px-6 sm:py-5">
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
