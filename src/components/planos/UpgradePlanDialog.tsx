import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Arte oficial FREE vs PRÓ (ficheiro em `public/planos/plano-pro-comparacao.png`). */
const PLANO_COMPARACAO_SRC = "/planos/plano-pro-comparacao.png";

const MIGRAR_PLANO_PRO_WEBHOOK =
  "https://n8n.e-transporte.pro/webhook/961260a3-709a-4aba-a810-dbd255875fb3";

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
      };

      const res = await fetch(MIGRAR_PLANO_PRO_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        toast.error(t ? `Erro ao enviar pedido (${res.status})` : `Erro ao enviar pedido (${res.status}).`);
        return;
      }

      toast.success("Em breve um dos administradores entrará em contato para alterar o seu plano.");
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
          "max-h-[min(94vh,920px)] w-[min(100vw-1rem,min(92vw,560px))] max-w-[min(100vw-1rem,min(92vw,560px))] gap-0 overflow-hidden p-0 sm:rounded-xl",
          "border-neutral-800 bg-neutral-950",
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
              className="w-full bg-[#FF6600] font-semibold uppercase tracking-wide text-white hover:bg-[#e65c00] sm:min-w-[220px] sm:flex-1"
              disabled={submitting}
              onClick={() => void handleMigrar()}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A enviar…
                </>
              ) : (
                "MIGRAR PARA PLANO PRÓ"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full border-neutral-600 bg-transparent font-semibold uppercase tracking-wide text-white hover:bg-white/10 sm:min-w-[140px]"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              FECHAR
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
