import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buildAgendaItemsPorDiaAtribuidoSomente, type AgendaItem } from "@/lib/painelAgendaReservas";
import FrotaReservaDetalheSheet from "@/components/frota/FrotaReservaDetalheSheet";
import {
  listFrotaPortalReservations,
  type FrotaPortalGrupoReserva,
  type FrotaPortalTransferReserva,
} from "@/lib/frotaPortalReservations";
import { AgendaMonthView } from "@/components/agenda/AgendaMonthView";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

export default function FrotaAgendaPage() {
  const today = new Date();
  const [cursor, setCursor] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }));
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<FrotaPortalTransferReserva[]>([]);
  const [grupos, setGrupos] = useState<FrotaPortalGrupoReserva[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [detailTransfer, setDetailTransfer] = useState<FrotaPortalTransferReserva | null>(null);
  const [detailGrupo, setDetailGrupo] = useState<FrotaPortalGrupoReserva | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      setUserId(uid);
      if (!uid) {
        setTransfers([]);
        setGrupos([]);
        return;
      }

      const safe = await listFrotaPortalReservations();
      if (safe.error) {
        toast.error("Erro ao carregar reservas.");
        setTransfers([]);
        setGrupos([]);
      } else {
        setTransfers(safe.transfers);
        setGrupos(safe.grupos);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const itemsByDay = useMemo((): Map<string, AgendaItem[]> => {
    if (!userId) return new Map();
    return buildAgendaItemsPorDiaAtribuidoSomente(transfers, grupos, userId);
  }, [transfers, grupos, userId]);

  const { y, m } = cursor;
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const prevMonth = () => {
    setCursor((c) => {
      const nm = c.m - 1;
      if (nm < 0) return { y: c.y - 1, m: 11 };
      return { y: c.y, m: nm };
    });
  };

  const nextMonth = () => {
    setCursor((c) => {
      const nm = c.m + 1;
      if (nm > 11) return { y: c.y + 1, m: 0 };
      return { y: c.y, m: nm };
    });
  };

  const goToday = () => {
    const n = new Date();
    setCursor({ y: n.getFullYear(), m: n.getMonth() });
  };

  const openDetail = useCallback(async (it: AgendaItem) => {
    try {
      if (it.kind === "transfer") {
        const row = transfers.find((r) => r.id === it.reservaId) ?? null;
        if (!row) {
          toast.error("Não foi possível abrir a reserva.");
          return;
        }
        setDetailGrupo(null);
        setDetailTransfer(row);
        setDetailOpen(true);
        return;
      }
      const row = grupos.find((r) => r.id === it.reservaId) ?? null;
      if (!row) {
        toast.error("Não foi possível abrir a reserva.");
        return;
      }
      setDetailTransfer(null);
      setDetailGrupo(row);
      setDetailOpen(true);
    } catch {
      toast.error("Erro ao carregar detalhes.");
    }
  }, [grupos, transfers]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <CalendarDays className="h-7 w-7 text-primary" />
            Agenda
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Apenas serviços <strong className="text-foreground">atribuídos a si</strong> pelo operador.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Atualizar">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={goToday}>
            Hoje
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={prevMonth} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={nextMonth} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-center text-lg font-semibold capitalize text-foreground">
          {MONTHS_PT[m]} <span className="text-muted-foreground">{y}</span>
        </p>
        <div className="w-[88px] sm:w-24" aria-hidden />
      </div>

      <AgendaMonthView
        year={y}
        monthIndex={m}
        todayKey={todayKey}
        itemsByDay={itemsByDay}
        onItemClick={(it) => void openDetail(it)}
      />

      {loading ? <p className="text-sm text-muted-foreground">A carregar…</p> : null}

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
        onSaved={() => {
          void load();
        }}
      />
    </div>
  );
}
