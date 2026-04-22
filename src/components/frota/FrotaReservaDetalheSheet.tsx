import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { RESERVA_STATUS_OPTIONS } from "@/lib/reservaStatus";
import { generateGrupoPDF, generateTransferPDF } from "@/lib/pdfGenerator";
import { Download, Loader2 } from "lucide-react";

type Props = {
  transfer: Tables<"reservas_transfer"> | null;
  grupo: Tables<"reservas_grupos"> | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
};

export default function FrotaReservaDetalheSheet({ transfer, grupo, open, onOpenChange, onSaved }: Props) {
  const [status, setStatus] = useState("pendente");
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const isTransfer = transfer != null;

  useEffect(() => {
    if (!open) return;
    const s = (isTransfer ? transfer?.status : grupo?.status) ?? "pendente";
    setStatus(s.trim() || "pendente");
  }, [open, isTransfer, transfer, grupo]);

  const row = transfer ?? grupo;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isTransfer ? "Reserva de transfer" : "Reserva de grupo"}</SheetTitle>
          <p className="text-sm text-muted-foreground">Altere o estado ou faça download do PDF (inclui contrato se o operador o tiver activo).</p>
        </SheetHeader>
        {row ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm">
              <span className="text-muted-foreground">Cliente: </span>
              <span className="font-medium">{isTransfer ? transfer!.nome_completo : grupo!.nome_completo}</span>
            </p>
            <div className="space-y-2">
              <Label>Estado da reserva</Label>
              <Select
                value={RESERVA_STATUS_OPTIONS.some((o) => o.value === status) ? status : "pendente"}
                onValueChange={setStatus}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESERVA_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                className="bg-primary text-primary-foreground"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    if (isTransfer && transfer) {
                      const { error } = await supabase.from("reservas_transfer").update({ status }).eq("id", transfer.id);
                      if (error) {
                        toast.error(error.message);
                        return;
                      }
                    } else if (grupo) {
                      const { error } = await supabase.from("reservas_grupos").update({ status }).eq("id", grupo.id);
                      if (error) {
                        toast.error(error.message);
                        return;
                      }
                    }
                    toast.success("Estado atualizado.");
                    onSaved();
                    onOpenChange(false);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Guardar estado
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pdfLoading}
                onClick={async () => {
                  setPdfLoading(true);
                  try {
                    toast.info("A gerar PDF…");
                    if (isTransfer && transfer) await generateTransferPDF(transfer.id);
                    else if (grupo) await generateGrupoPDF(grupo.id);
                  } finally {
                    setPdfLoading(false);
                  }
                }}
              >
                {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download PDF
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
