import { useCallback, useEffect, useState } from "react";
import { Eye, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { badgeToneReservaStatus, labelReservaStatus } from "@/lib/reservaStatus";
import FrotaReservaDetalheSheet from "@/components/frota/FrotaReservaDetalheSheet";
import { cn } from "@/lib/utils";
import { formatDbCalendarDatePtBr } from "@/lib/painelAgendaReservas";
import { formatTransferTipoViagemExibicao } from "@/lib/transferPernaViagem";
import {
  listFrotaPortalReservations,
  type FrotaPortalGrupoReserva,
  type FrotaPortalTransferReserva,
} from "@/lib/frotaPortalReservations";

export default function FrotaReservasPage() {
  const [transfers, setTransfers] = useState<FrotaPortalTransferReserva[]>([]);
  const [grupos, setGrupos] = useState<FrotaPortalGrupoReserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailTransfer, setDetailTransfer] = useState<FrotaPortalTransferReserva | null>(null);
  const [detailGrupo, setDetailGrupo] = useState<FrotaPortalGrupoReserva | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr || !auth.user?.id) {
        setTransfers([]);
        setGrupos([]);
        return;
      }

      const safe = await listFrotaPortalReservations();
      if (safe.error) toast.error("Erro ao carregar reservas atribuídas.");
      setTransfers(safe.transfers);
      setGrupos(safe.grupos);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openTransfer = (id: string) => {
    const row = transfers.find((r) => r.id === id) ?? null;
    if (!row) {
      toast.error("Reserva indisponível.");
      return;
    }
    setDetailGrupo(null);
    setDetailTransfer(row);
    setDetailOpen(true);
  };

  const openGrupo = (id: string) => {
    const row = grupos.find((r) => r.id === id) ?? null;
    if (!row) {
      toast.error("Reserva indisponível.");
      return;
    }
    setDetailTransfer(null);
    setDetailGrupo(row);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reservas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Transfer e grupos <strong className="text-foreground">atribuídos a si</strong>. Dados de clientes e PDFs
            ficam restritos ao operador.
          </p>
        </div>
        <Button type="button" variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Atualizar">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Transfer</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">A carregar…</p>
          ) : transfers.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Sem reservas de transfer atribuídas.</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Trajeto</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm text-muted-foreground">#{r.numero_reserva}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="secondary">
                          {formatTransferTipoViagemExibicao(r.tipo_viagem, r.perna_viagem)}
                        </Badge>
                        {(r.perna_viagem === "ida" || r.perna_viagem === "volta") && (
                          <Badge
                            variant="outline"
                            className="border-[#FF6600]/60 text-[#FF6600] dark:border-[#FF6600]/50 dark:text-[#FF6600]"
                          >
                            {r.perna_viagem === "volta" ? "VOLTA" : "IDA"}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {r.ida_embarque && r.ida_desembarque ? `${r.ida_embarque} → ${r.ida_desembarque}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.tipo_viagem === "por_hora"
                        ? formatDbCalendarDatePtBr(r.por_hora_data)
                        : formatDbCalendarDatePtBr(r.ida_data)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeToneReservaStatus(r.status)}>{labelReservaStatus(r.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => openTransfer(r.id)}>
                        <Eye className="mr-1 h-4 w-4" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Grupos</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">A carregar…</p>
          ) : grupos.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Sem reservas de grupo atribuídas.</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Trajeto</TableHead>
                  <TableHead>Data Ida</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupos.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm text-muted-foreground">#{r.numero_reserva}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {r.embarque && r.destino ? `${r.embarque} → ${r.destino}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{formatDbCalendarDatePtBr(r.data_ida)}</TableCell>
                    <TableCell>
                      <Badge variant={badgeToneReservaStatus(r.status)}>{labelReservaStatus(r.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => openGrupo(r.id)}>
                        <Eye className="mr-1 h-4 w-4" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </div>
      </div>

      <FrotaReservaDetalheSheet
        transfer={detailTransfer}
        grupo={detailGrupo}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) {
            setDetailTransfer(null);
            setDetailGrupo(null);
          }
        }}
        onSaved={() => void load()}
      />
    </div>
  );
}
