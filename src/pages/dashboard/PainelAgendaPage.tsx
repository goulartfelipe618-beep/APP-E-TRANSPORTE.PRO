import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  agendaItemCodigoNoPassado,
  buildAgendaItemsPorDia,
  type AgendaItem,
} from "@/lib/painelAgendaReservas";
import DetalhesReservaTransferSheet from "@/components/reservas/DetalhesReservaTransferSheet";
import DetalhesReservaGrupoSheet from "@/components/reservas/DetalhesReservaGrupoSheet";
import ComunicarDialog from "@/components/comunicar/ComunicarDialog";
import { generateGrupoPDF, generateTransferPDF, getGrupoReservaPdfBase64, getTransferReservaPdfBase64 } from "@/lib/pdfGenerator";

const WEEKDAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function startWeekdayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex, 1).getDay();
}

export default function PainelAgendaPage() {
  const today = new Date();
  const [cursor, setCursor] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }));
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<Tables<"reservas_transfer">[]>([]);
  const [grupos, setGrupos] = useState<Tables<"reservas_grupos">[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [detailTransfer, setDetailTransfer] = useState<Tables<"reservas_transfer"> | null>(null);
  const [detailGrupo, setDetailGrupo] = useState<Tables<"reservas_grupos"> | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [comunicarOpen, setComunicarOpen] = useState(false);
  const [comunicarTransfer, setComunicarTransfer] = useState<Tables<"reservas_transfer"> | null>(null);
  const [comunicarGrupo, setComunicarGrupo] = useState<Tables<"reservas_grupos"> | null>(null);

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

      const [tRes, gRes] = await Promise.all([
        supabase
          .from("reservas_transfer")
          .select(
            "id, tipo_viagem, numero_reserva, status, user_id, motorista_id, ida_data, ida_hora, volta_data, volta_hora, por_hora_data, por_hora_hora, ida_embarque, ida_desembarque, volta_embarque, volta_desembarque, por_hora_endereco_inicio, por_hora_ponto_encerramento",
          ),
        supabase
          .from("reservas_grupos")
          .select(
            "id, numero_reserva, status, user_id, motorista_id, data_ida, hora_ida, data_retorno, hora_retorno, embarque, destino",
          ),
      ]);

      if (tRes.error) {
        toast.error("Erro ao carregar reservas de transfer.");
        setTransfers([]);
      } else {
        setTransfers((tRes.data as Tables<"reservas_transfer">[]) ?? []);
      }
      if (gRes.error) {
        toast.error("Erro ao carregar reservas de grupos.");
        setGrupos([]);
      } else {
        setGrupos((gRes.data as Tables<"reservas_grupos">[]) ?? []);
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
    return buildAgendaItemsPorDia(transfers, grupos, userId);
  }, [transfers, grupos, userId]);

  const { y, m } = cursor;
  const dim = daysInMonth(y, m);
  const startPad = startWeekdayOfMonth(y, m);
  const totalSlots = Math.ceil((startPad + dim) / 7) * 7;
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

  const openAgendaDetail = useCallback(async (it: AgendaItem) => {
    try {
      if (it.kind === "transfer") {
        const { data, error } = await supabase.from("reservas_transfer").select("*").eq("id", it.reservaId).maybeSingle();
        if (error || !data) {
          toast.error("Não foi possível abrir a reserva de transfer.");
          return;
        }
        setDetailGrupo(null);
        setDetailTransfer(data as Tables<"reservas_transfer">);
        setDetailSheetOpen(true);
        return;
      }
      const { data, error } = await supabase.from("reservas_grupos").select("*").eq("id", it.reservaId).maybeSingle();
      if (error || !data) {
        toast.error("Não foi possível abrir a reserva de grupo.");
        return;
      }
      setDetailTransfer(null);
      setDetailGrupo(data as Tables<"reservas_grupos">);
      setDetailSheetOpen(true);
    } catch {
      toast.error("Erro ao carregar detalhes da reserva.");
    }
  }, []);

  const handleComunicarTransfer = useCallback((r: Tables<"reservas_transfer">) => {
    setComunicarTransfer(r);
    setComunicarGrupo(null);
    setComunicarOpen(true);
  }, []);

  const handleComunicarGrupo = useCallback((r: Tables<"reservas_grupos">) => {
    setComunicarGrupo(r);
    setComunicarTransfer(null);
    setComunicarOpen(true);
  }, []);

  const handleDownloadTransfer = useCallback(async (r: Tables<"reservas_transfer">) => {
    toast.info("Gerando PDF...");
    await generateTransferPDF(r.id);
  }, []);

  const handleDownloadGrupo = useCallback(async (r: Tables<"reservas_grupos">) => {
    toast.info("Gerando PDF...");
    await generateGrupoPDF(r.id);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <CalendarDays className="h-7 w-7 text-primary" />
            Agenda
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Calendário com as suas <strong className="text-foreground">reservas</strong> (transfer e grupos). Solicitações
            não aparecem aqui. Os dados respeitam a sua conta (RLS) e o mesmo critério de visibilidade do painel (frota
            atribuída a si ou criada por si).
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

      <div className="overflow-x-auto rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="grid min-w-[720px] grid-cols-7 gap-1.5">
          {WEEKDAYS_PT.map((wd) => (
            <div
              key={wd}
              className="border-b border-border pb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {wd}
            </div>
          ))}
          {Array.from({ length: totalSlots }, (_, i) => {
            const dayNum = i - startPad + 1;
            if (dayNum < 1 || dayNum > dim) {
              return (
                <div
                  key={`empty-${i}`}
                  className="min-h-[100px] rounded-lg border border-dashed border-border/60 bg-muted/20 sm:min-h-[120px]"
                />
              );
            }
            const dayKey = `${y}-${String(m + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const items = itemsByDay.get(dayKey) ?? [];
            const isToday = todayKey === dayKey;

            return (
              <div
                key={dayKey}
                className={cn(
                  "flex min-h-[100px] flex-col gap-1 rounded-lg border p-1.5 sm:min-h-[120px] sm:p-2",
                  isToday ? "border-primary/60 bg-primary/5" : "border-border bg-background",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold",
                    isToday ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                >
                  {dayNum}
                </span>
                <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
                  {items.map((it) => {
                    const noPassado = agendaItemCodigoNoPassado(it);
                    const title = `${it.numeroLabel} · ${it.perna} · ${it.horario} — ${it.trajetoResumo}`;
                    return (
                      <button
                        key={it.key}
                        type="button"
                        onClick={() => void openAgendaDetail(it)}
                        className={cn(
                          "flex w-full min-w-0 max-w-full items-center gap-1 rounded border border-border/80 bg-muted/40 px-1 py-0.5 text-left text-[10px] leading-tight text-foreground transition-colors hover:bg-muted/70 sm:text-xs",
                        )}
                        title={title}
                      >
                        <span
                          className={cn(
                            "shrink-0 font-mono font-semibold tabular-nums",
                            noPassado ? "text-red-500" : "text-green-500",
                          )}
                        >
                          {it.numeroLabel}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{it.trajetoResumo}</span>
                        <span className="shrink-0 whitespace-nowrap text-muted-foreground">· {it.horario}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">A carregar reservas…</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Reservas com data/hora preenchidas aparecem no dia correspondente. Ida e volta geram entradas separadas (com
          horários distintos quando informados). Toque numa linha para ver detalhes. O código fica{" "}
          <span className="text-green-500">verde</span> se o horário do dia ainda não passou e{" "}
          <span className="text-red-500">vermelho</span> se já passou ou a reserva está concluída.
        </p>
      )}

      <DetalhesReservaTransferSheet
        reserva={detailTransfer}
        open={detailSheetOpen && detailTransfer != null}
        onOpenChange={(open) => {
          setDetailSheetOpen(open);
          if (!open) setDetailTransfer(null);
        }}
        onComunicar={handleComunicarTransfer}
        onDownload={handleDownloadTransfer}
      />

      <DetalhesReservaGrupoSheet
        reserva={detailGrupo}
        open={detailSheetOpen && detailGrupo != null}
        onOpenChange={(open) => {
          setDetailSheetOpen(open);
          if (!open) setDetailGrupo(null);
        }}
        onComunicar={handleComunicarGrupo}
        onDownload={handleDownloadGrupo}
      />

      {comunicarTransfer && (
        <ComunicarDialog
          open={comunicarOpen && comunicarTransfer != null}
          onOpenChange={(o) => {
            setComunicarOpen(o);
            if (!o) setComunicarTransfer(null);
          }}
          dados={comunicarTransfer}
          telefone={comunicarTransfer.telefone}
          titulo="Comunicar — Reserva Transfer"
          onGerarPDF={() => generateTransferPDF(comunicarTransfer.id)}
          webhookTipo="transfer_reserva"
          getConfirmacaoReservaPdfBase64={() => getTransferReservaPdfBase64(comunicarTransfer.id)}
        />
      )}

      {comunicarGrupo && (
        <ComunicarDialog
          open={comunicarOpen && comunicarGrupo != null}
          onOpenChange={(o) => {
            setComunicarOpen(o);
            if (!o) setComunicarGrupo(null);
          }}
          dados={comunicarGrupo}
          telefone={comunicarGrupo.whatsapp}
          titulo="Comunicar — Reserva de Grupo"
          onGerarPDF={() => generateGrupoPDF(comunicarGrupo.id)}
          webhookTipo="grupo_reserva"
          getConfirmacaoReservaPdfBase64={() => getGrupoReservaPdfBase64(comunicarGrupo.id)}
        />
      )}
    </div>
  );
}
