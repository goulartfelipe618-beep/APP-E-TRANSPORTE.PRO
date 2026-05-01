import { useState } from "react";
import { CheckCircle2, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Rastreio = Tables<"rastreios_ao_vivo">;

export type BotaoEncerrarViagemProps = {
  rastreioId: string;
  /** Callback após encerrar com sucesso — recebe a linha atualizada já com o resumo. */
  onEncerrada?: (rastreio: Rastreio) => void;
  /** Desabilita o botão (ex.: já está 'concluida'). */
  disabled?: boolean;
  className?: string;
  /** Variante visual do botão. */
  variant?: "destructive" | "default";
};

export default function BotaoEncerrarViagem({
  rastreioId,
  onEncerrada,
  disabled,
  className,
  variant = "destructive",
}: BotaoEncerrarViagemProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async (event: React.MouseEvent) => {
    event.preventDefault();

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("encerrar_rastreio", {
        p_rastreio_id: rastreioId,
        p_origem: null,
        p_destino: null,
        p_valor_total: null,
        p_distancia_km: null,
        p_duracao_segundos: null,
      });

      if (error) throw error;

      toast.success("Viagem encerrada. Início e fim do trajeto foram registados.");
      setOpen(false);
      if (data && onEncerrada) onEncerrada(data as Rastreio);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao encerrar a viagem.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          className={cn("gap-2", className)}
          disabled={disabled || submitting}
        >
          <Square className="h-4 w-4" aria-hidden />
          Encerrar viagem
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#FF6600]" aria-hidden />
            Encerrar viagem?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-2">
            <span className="block">
              Confirma que deseja terminar esta viagem? Ela será marcada como{" "}
              <strong>concluída</strong>.
            </span>
            <span className="block text-muted-foreground">
              O sistema regista as coordenadas de <strong>início</strong> e <strong>fim</strong> do trajeto,
              calcula distância e tempo a partir do percorrido e remove os pontos GPS intermédios. Pode
              consultar o resumo na lista de links desta conta.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={submitting}
            className="gap-2 bg-[#FF6600] text-white hover:bg-[#e65c00]"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            )}
            Sim, encerrar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
