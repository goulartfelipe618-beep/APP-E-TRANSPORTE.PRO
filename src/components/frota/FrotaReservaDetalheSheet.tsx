import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RESERVA_STATUS_OPTIONS } from "@/lib/reservaStatus";
import { Loader2 } from "lucide-react";
import type { FrotaPortalGrupoReserva, FrotaPortalTransferReserva } from "@/lib/frotaPortalReservations";
import { formatTransferTipoViagemExibicao } from "@/lib/transferPernaViagem";

type Props = {
  transfer: FrotaPortalTransferReserva | null;
  grupo: FrotaPortalGrupoReserva | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
};

export default function FrotaReservaDetalheSheet({ transfer, grupo, open, onOpenChange, onSaved }: Props) {
  const [status, setStatus] = useState("pendente");
  const [saving, setSaving] = useState(false);

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
          <p className="text-sm text-muted-foreground">
            Altere apenas o estado operacional. Dados pessoais do cliente e PDF de confirmação são restritos ao
            operador da frota.
          </p>
        </SheetHeader>
        {row ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm">
              <span className="text-muted-foreground">Reserva: </span>
              <span className="font-medium">#{row.numero_reserva}</span>
            </p>
            {isTransfer && transfer ? (
              <p className="text-sm">
                <span className="text-muted-foreground">Tipo: </span>
                <span className="font-medium">
                  {formatTransferTipoViagemExibicao(transfer.tipo_viagem, transfer.perna_viagem)}
                </span>
              </p>
            ) : null}
            <p className="text-sm">
              <span className="text-muted-foreground">Trajeto: </span>
              <span className="font-medium">
                {isTransfer
                  ? transfer?.tipo_viagem === "por_hora"
                    ? `${transfer.por_hora_endereco_inicio ?? "—"} → ${transfer.por_hora_ponto_encerramento ?? "—"}`
                    : `${transfer?.ida_embarque ?? "—"} → ${transfer?.ida_desembarque ?? "—"}`
                  : `${grupo?.embarque ?? "—"} → ${grupo?.destino ?? "—"}`}
              </span>
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
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
