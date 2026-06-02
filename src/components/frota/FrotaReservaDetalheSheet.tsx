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
import { formatDbCalendarDatePtBr, formatHoraReserva } from "@/lib/painelAgendaReservas";

type Props = {
  transfer: FrotaPortalTransferReserva | null;
  grupo: FrotaPortalGrupoReserva | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  const text = value == null || value === "" ? "—" : String(value);
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-foreground">{text}</p>
    </div>
  );
}

function TransferSchedule({ transfer }: { transfer: FrotaPortalTransferReserva }) {
  if (transfer.tipo_viagem === "por_hora") {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <DetailRow label="Data" value={formatDbCalendarDatePtBr(transfer.por_hora_data)} />
        <DetailRow label="Hora" value={formatHoraReserva(transfer.por_hora_hora)} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <DetailRow label="Data ida" value={formatDbCalendarDatePtBr(transfer.ida_data)} />
      <DetailRow label="Hora ida" value={formatHoraReserva(transfer.ida_hora)} />
      {transfer.volta_data || transfer.volta_hora ? (
        <>
          <DetailRow label="Data volta" value={formatDbCalendarDatePtBr(transfer.volta_data)} />
          <DetailRow label="Hora volta" value={formatHoraReserva(transfer.volta_hora)} />
        </>
      ) : null}
    </div>
  );
}

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
            Mini painel isolado do motorista. Dados de contacto do cliente ficam ocultos e restritos ao operador da
            frota.
          </p>
        </SheetHeader>
        {row ? (
          <div className="mt-6 space-y-5">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Relatório da viagem</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <DetailRow label="Reserva" value={`#${row.numero_reserva}`} />
                <DetailRow label="Passageiros" value={row.num_passageiros ?? "—"} />
                <DetailRow label="Valor total" value={formatCurrency(row.valor_total)} />
                <DetailRow label="Repasse motorista" value={formatCurrency(row.repasse_motorista)} />
              </div>
            </div>

            {isTransfer && transfer ? (
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <DetailRow label="Tipo" value={formatTransferTipoViagemExibicao(transfer.tipo_viagem, transfer.perna_viagem)} />
                <TransferSchedule transfer={transfer} />
                {transfer.tipo_viagem === "por_hora" ? (
                  <div className="grid grid-cols-1 gap-2">
                    <DetailRow label="Endereço inicial" value={transfer.por_hora_endereco_inicio} />
                    <DetailRow label="Ponto de encerramento" value={transfer.por_hora_ponto_encerramento} />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    <DetailRow label="Embarque ida" value={transfer.ida_embarque} />
                    <DetailRow label="Desembarque ida" value={transfer.ida_desembarque} />
                    {transfer.volta_embarque || transfer.volta_desembarque ? (
                      <>
                        <DetailRow label="Embarque volta" value={transfer.volta_embarque} />
                        <DetailRow label="Desembarque volta" value={transfer.volta_desembarque} />
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}

            {!isTransfer && grupo ? (
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <DetailRow label="Data ida" value={formatDbCalendarDatePtBr(grupo.data_ida)} />
                  <DetailRow label="Hora ida" value={formatHoraReserva(grupo.hora_ida)} />
                  <DetailRow label="Data retorno" value={formatDbCalendarDatePtBr(grupo.data_retorno)} />
                  <DetailRow label="Hora retorno" value={formatHoraReserva(grupo.hora_retorno)} />
                </div>
                <DetailRow label="Embarque" value={grupo.embarque} />
                <DetailRow label="Destino" value={grupo.destino} />
              </div>
            ) : null}

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Observações da reserva</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {row.observacoes?.trim() || "Sem observações cadastradas."}
              </p>
            </div>

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
