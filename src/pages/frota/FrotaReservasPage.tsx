import { useCallback, useEffect, useState } from "react";
import { Eye, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tables } from "@/integrations/supabase/types";
import { badgeToneReservaStatus, labelReservaStatus } from "@/lib/reservaStatus";
import FrotaReservaDetalheSheet from "@/components/frota/FrotaReservaDetalheSheet";
import { cn } from "@/lib/utils";

const tipoLabel: Record<string, string> = {
  somente_ida: "Somente Ida",
  ida_volta: "Ida e Volta",
  por_hora: "Por Hora",
};

export default function FrotaReservasPage() {
  const [transfers, setTransfers] = useState<Tables<"reservas_transfer">[]>([]);
  const [grupos, setGrupos] = useState<Tables<"reservas_grupos">[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailTransfer, setDetailTransfer] = useState<Tables<"reservas_transfer"> | null>(null);
  const [detailGrupo, setDetailGrupo] = useState<Tables<"reservas_grupos"> | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const id = auth.user?.id ?? null;
      if (!id) {
        setTransfers([]);
        setGrupos([]);
        return;
      }

      const [tRes, gRes] = await Promise.all([
        supabase.from("reservas_transfer").select("*").order("created_at", { ascending: false }),
        supabase.from("reservas_grupos").select("*").order("created_at", { ascending: false }),
      ]);

      if (tRes.error) toast.error("Erro ao carregar transfers.");
      else {
        const all = (tRes.data as Tables<"reservas_transfer">[]) ?? [];
        setTransfers(all.filter((r) => (r.motorista_id ?? "").trim() === id));
      }

      if (gRes.error) toast.error("Erro ao carregar grupos.");
      else {
        const all = (gRes.data as Tables<"reservas_grupos">[]) ?? [];
        setGrupos(all.filter((r) => r.motorista_id === id));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openTransfer = async (id: string) => {
    const { data, error } = await supabase.from("reservas_transfer").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      toast.error("Reserva indisponível.");
      return;
    }
    setDetailGrupo(null);
    setDetailTransfer(data as Tables<"reservas_transfer">);
    setDetailOpen(true);
  };

  const openGrupo = async (id: string) => {
    const { data, error } = await supabase.from("reservas_grupos").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      toast.error("Reserva indisponível.");
      return;
    }
    setDetailTransfer(null);
    setDetailGrupo(data as Tables<"reservas_grupos">);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reservas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Transfer e grupos <strong className="text-foreground">atribuídos a si</strong>. Apenas visualizar estado e PDF.
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cliente</TableHead>
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
                    <TableCell className="font-medium">{r.nome_completo}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{tipoLabel[r.tipo_viagem] || r.tipo_viagem}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {r.ida_embarque && r.ida_desembarque ? `${r.ida_embarque} → ${r.ida_desembarque}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.ida_data ? new Date(r.ida_data).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeToneReservaStatus(r.status)}>{labelReservaStatus(r.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => void openTransfer(r.id)}>
                        <Eye className="mr-1 h-4 w-4" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cliente</TableHead>
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
                    <TableCell className="font-medium">{r.nome_completo}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {r.embarque && r.destino ? `${r.embarque} → ${r.destino}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.data_ida ? new Date(r.data_ida).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badgeToneReservaStatus(r.status)}>{labelReservaStatus(r.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => void openGrupo(r.id)}>
                        <Eye className="mr-1 h-4 w-4" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
