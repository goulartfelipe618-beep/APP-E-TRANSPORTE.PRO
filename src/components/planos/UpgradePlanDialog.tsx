import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PLAN_LABELS, PLAN_PRICE_LABELS, type PlanType } from "@/hooks/useUserPlan";

const MIGRAR_PLANO_WEBHOOK =
  "https://n8n.e-transporte.pro/webhook/961260a3-709a-4aba-a810-dbd255875fb3";

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FREE_FEATURES = [
  "Painel completo e Financeiro",
  "Transfer e Grupos — Reservas (até 3 por dia)",
  "Motoristas — até 3 cadastros",
  "Clientes ilimitados",
  "Geolocalização — até 3 links/mês",
  "Receptivos e QR Codes ilimitados",
  "Network, Comunidade, Disparador e Empty Legs (beta)",
  "Anotações e Suporte",
];

const STANDART_FEATURES = [
  "Tudo do FREE, com reservas e motoristas ilimitados",
  "Contratos Transfer e Grupos",
  "Campanhas (Ativos e Leads)",
  "Link do mini painel do motorista continua a exigir PRÓ",
];

const PRO_FEATURES = [
  "Tudo do STANDART",
  "Solicitações (Transfer, Grupos e Motoristas)",
  "Link do mini painel do motorista ativo",
  "E-mail Business, Website, Domínios",
  "Automações",
  "Prioridade nas integrações premium",
];

function PlanCard({
  tier,
  highlight,
  features,
}: {
  tier: PlanType;
  highlight?: boolean;
  features: string[];
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border p-4 sm:p-5",
        highlight
          ? "border-[#FF6600]/60 bg-[#FF6600]/10 shadow-[0_0_0_1px_rgba(255,102,0,0.15)]"
          : "border-neutral-700 bg-neutral-900/80",
      )}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold tracking-tight text-white">{PLAN_LABELS[tier]}</h3>
        <p className="text-xl font-semibold text-[#FF6600]">{PLAN_PRICE_LABELS[tier]}</p>
      </div>
      <p className="mb-3 text-xs text-neutral-400">
        {tier === "free" && "Entrada na plataforma com limites claros para operação diária."}
        {tier === "standart" && "Operação completa com contratos e marketing de campanhas."}
        {tier === "pro" && "Suite premium: solicitações, portal do motorista e canais digitais."}
      </p>
      <ul className="flex-1 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex gap-2 text-sm text-neutral-200">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6600]" aria-hidden />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function UpgradePlanDialog({ open, onOpenChange }: UpgradePlanDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) setSubmitting(false);
  }, [open]);

  const handleMigrar = async () => {
    setSubmitting(true);
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) {
        toast.error("Sessão inválida. Inicie sessão novamente.");
        return;
      }

      const { data: cfg, error: cfgErr } = await supabase
        .from("configuracoes")
        .select("nome_completo, email, telefone, nome_empresa, cnpj, endereco_completo")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cfgErr) {
        console.error(cfgErr);
        toast.error("Não foi possível ler as suas configurações.");
        return;
      }

      const payload = {
        user_id: user.id,
        nome_completo: cfg?.nome_completo ?? "",
        email: cfg?.email ?? user.email ?? "",
        telefone: cfg?.telefone ?? "",
        nome_empresa: cfg?.nome_empresa ?? "",
        cnpj: cfg?.cnpj ?? "",
        endereco_completo: cfg?.endereco_completo ?? "",
        origem: "upgrade_plan_dialog",
        enviado_em: new Date().toISOString(),
        mensagem: "Pedido de upgrade / informação sobre planos FREE, STANDART ou PRÓ.",
      };

      const res = await fetch(MIGRAR_PLANO_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        toast.error(t ? `Erro ao enviar pedido (${res.status})` : `Erro ao enviar pedido (${res.status}).`);
        return;
      }

      toast.success("Em breve um dos administradores entrará em contacto para o plano pretendido.");
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao enviar o pedido.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "max-h-[min(94vh,920px)] w-[min(100vw-1rem,min(92vw,720px))] max-w-[min(100vw-1rem,min(92vw,720px))] gap-0 overflow-hidden p-0 sm:rounded-xl",
          "border-neutral-800 bg-neutral-950",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Planos FREE, STANDART e PRÓ</DialogTitle>
          <DialogDescription>Comparativo de funcionalidades e preços mensais.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(70vh,680px)] overflow-y-auto border-b border-neutral-800 bg-neutral-950 px-4 py-5 sm:px-6">
          <p className="mb-4 text-center text-sm text-neutral-300">
            Escolha o plano que melhor encaixa na sua operação. O administrador confirma e ativa na sua conta.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <PlanCard tier="free" features={FREE_FEATURES} />
            <PlanCard tier="standart" features={STANDART_FEATURES} />
            <PlanCard tier="pro" highlight features={PRO_FEATURES} />
          </div>
        </div>

        <div className="space-y-3 bg-neutral-950 px-4 py-4 sm:px-6 sm:py-5">
          <p className="text-center text-xs text-neutral-400">
            Se o plano pago terminar, os seus dados não são apagados — o acesso às funções premium fica suspenso até renovar.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
            <Button
              type="button"
              className="w-full bg-[#FF6600] font-semibold uppercase tracking-wide text-white hover:bg-[#e65c00] sm:min-w-[220px] sm:flex-1"
              disabled={submitting}
              onClick={() => void handleMigrar()}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A enviar…
                </>
              ) : (
                "Pedir STANDART ou PRÓ"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full border-neutral-600 bg-transparent font-semibold uppercase tracking-wide text-white hover:bg-white/10 sm:min-w-[140px]"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
