import { useState } from "react";
import { CheckCircle2, Loader2, Square } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const encerrarSchema = z.object({
  origem: z.string().trim().min(3, "Informe a origem.").max(200).optional().or(z.literal("")),
  destino: z.string().trim().min(3, "Informe o destino.").max(200).optional().or(z.literal("")),
  valorTotal: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\d+([.,]\d{1,2})?$/.test(v.trim()),
      "Valor inválido. Use formato 123,45 ou 123.45.",
    ),
});

export type BotaoEncerrarViagemProps = {
  rastreioId: string;
  /** Valores pré-preenchidos opcionais. */
  origemInicial?: string;
  destinoInicial?: string;
  valorInicial?: number | null;
  /** Callback após encerrar com sucesso — recebe a linha atualizada já com o resumo. */
  onEncerrada?: (rastreio: Rastreio) => void;
  /** Desabilita o botão (ex.: já está 'concluida'). */
  disabled?: boolean;
  className?: string;
  /** Variante visual do botão. */
  variant?: "destructive" | "default";
};

function parseValor(raw: string): number | null {
  const v = raw.trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
}

export default function BotaoEncerrarViagem({
  rastreioId,
  origemInicial = "",
  destinoInicial = "",
  valorInicial = null,
  onEncerrada,
  disabled,
  className,
  variant = "destructive",
}: BotaoEncerrarViagemProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [origem, setOrigem] = useState(origemInicial);
  const [destino, setDestino] = useState(destinoInicial);
  const [valorTotal, setValorTotal] = useState(
    valorInicial !== null && valorInicial !== undefined
      ? String(valorInicial).replace(".", ",")
      : "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleConfirm = async (event: React.MouseEvent) => {
    event.preventDefault();

    const parsed = encerrarSchema.safeParse({ origem, destino, valorTotal });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((iss) => {
        if (iss.path[0]) fieldErrors[String(iss.path[0])] = iss.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      const valorNumero = parseValor(valorTotal);
      const { data, error } = await supabase.rpc("encerrar_rastreio", {
        p_rastreio_id: rastreioId,
        p_origem: origem.trim() || null,
        p_destino: destino.trim() || null,
        p_valor_total: valorNumero,
        p_distancia_km: null,
        p_duracao_segundos: null,
      });

      if (error) throw error;

      toast.success("Viagem encerrada. Resumo salvo e GPS removido.");
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

      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#FF6600]" aria-hidden />
            Encerrar viagem e salvar resumo
          </AlertDialogTitle>
          <AlertDialogDescription>
            Ao confirmar, a viagem é marcada como <strong>concluída</strong>. A distância e o tempo
            serão calculados automaticamente a partir do trajeto, e{" "}
            <strong>todos os pontos de GPS serão apagados</strong> — ficando apenas este resumo no
            banco.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="rastreio-origem">Origem</Label>
            <Input
              id="rastreio-origem"
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              placeholder="Ex.: Aeroporto de Congonhas"
              maxLength={200}
              autoComplete="off"
            />
            {errors.origem && <p className="text-xs text-destructive">{errors.origem}</p>}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="rastreio-destino">Destino</Label>
            <Input
              id="rastreio-destino"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="Ex.: Hotel Renaissance, Jardins"
              maxLength={200}
              autoComplete="off"
            />
            {errors.destino && <p className="text-xs text-destructive">{errors.destino}</p>}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="rastreio-valor">Valor cobrado (R$) — opcional</Label>
            <Input
              id="rastreio-valor"
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value)}
              placeholder="Ex.: 180,00"
              inputMode="decimal"
              autoComplete="off"
            />
            {errors.valorTotal && <p className="text-xs text-destructive">{errors.valorTotal}</p>}
          </div>
        </div>

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
            Confirmar encerramento
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
