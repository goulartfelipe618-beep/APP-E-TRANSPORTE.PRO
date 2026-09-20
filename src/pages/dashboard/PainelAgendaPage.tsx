import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  buildAgendaItemsPorDia,
  type AgendaItem,
} from "@/lib/painelAgendaReservas";
import DetalhesReservaTransferSheet from "@/components/reservas/DetalhesReservaTransferSheet";
import DetalhesReservaGrupoSheet from "@/components/reservas/DetalhesReservaGrupoSheet";
import ComunicarDialog from "@/components/comunicar/ComunicarDialog";
import { generateGrupoPDF, generateTransferPDF, getGrupoReservaPdfBase64, getTransferReservaPdfBase64 } from "@/lib/pdfGenerator";
import { buildGrupoDadosComunicarCliente, buildTransferDadosComunicarCliente } from "@/lib/comunicarReservaCliente";
import { AgendaMonthView } from "@/components/agenda/AgendaMonthView";
import { fetchAllSupabasePages } from "@/lib/supabaseFetchAll";

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
  const [comunicarTransferLinha, setComunicarTransferLinha] = useState<Tables<"reservas_transfer"> | null>(null);
  const [comunicarTransferPayload, setComunicarTransferPayload] = useState<Record<string, unknown> | null>(null);
  const [comunicarGrupoLinha, setComunicarGrupoLinha] = useState<Tables<"reservas_grupos"> | null>(null);
  const [comunicarGrupoPayload, setComunicarGrupoPayload] = useState<Record<string, unknown> | null>(null);

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
        fetchAllSupabasePages((from, to) =>
          supabase
            .from("reservas_transfer")
            .select(
              "id, tipo_viagem, perna_viagem, numero_reserva, status, user_id, motorista_id, categoria_veiculo, ida_data, ida_hora, volta_data, volta_hora, por_hora_data, por_hora_hora, ida_embarque, ida_desembarque, volta_embarque, volta_desembarque, por_hora_endereco_inicio, por_hora_ponto_encerramento",
            )
            .order("created_at", { ascending: false })
            .range(from, to),
        ),
        fetchAllSupabasePages((from, to) =>
          supabase
            .from("reservas_grupos")
            .select(
              "id, numero_reserva, status, user_id, motorista_id, perna_viagem, data_ida, hora_ida, data_retorno, hora_retorno, embarque, destino",
            )
            .order("created_at", { ascending: false })
            .range(from, to),
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
    return buildAgendaItemsPorDia(transfers, grupos);
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

  const handleComunicarTransfer = useCallback(async (r: Tables<"reservas_transfer">) => {
    try {
      const payload = await buildTransferDadosComunicarCliente(r);
      setComunicarGrupoLinha(null);
      setComunicarGrupoPayload(null);
      setComunicarTransferLinha(r);
      setComunicarTransferPayload(payload);
      setComunicarOpen(true);
    } catch {
      toast.error("Erro ao preparar dados para comunicação.");
    }
  }, []);

  const handleComunicarGrupo = useCallback(async (r: Tables<"reservas_grupos">) => {
    try {
      const payload = await buildGrupoDadosComunicarCliente(r);
      setComunicarTransferLinha(null);
      setComunicarTransferPayload(null);
      setComunicarGrupoLinha(r);
      setComunicarGrupoPayload(payload);
      setComunicarOpen(true);
    } catch {
      toast.error("Erro ao preparar dados para comunicação.");
    }
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
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <CalendarDays className="h-7 w-7 text-primary" />
            Agenda
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Calendário com as suas <strong className="text-foreground">reservas</strong> (transfer e grupos). Solicitações
            não aparecem aqui. A lista segue as mesmas regras de acesso da base de dados (RLS) que o menu Reservas:
            inclui serviços criados na sua conta, com ou sem motorista atribuído.
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
        onItemClick={(it) => void openAgendaDetail(it)}
      />

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

      {comunicarTransferLinha && comunicarTransferPayload && (
        <ComunicarDialog
          open={comunicarOpen && comunicarTransferLinha != null}
          onOpenChange={(o) => {
            setComunicarOpen(o);
            if (!o) {
              setComunicarTransferLinha(null);
              setComunicarTransferPayload(null);
            }
          }}
          dados={comunicarTransferPayload}
          telefone={
            typeof comunicarTransferPayload.telefone === "string" && comunicarTransferPayload.telefone.trim() !== ""
              ? comunicarTransferPayload.telefone
              : comunicarTransferLinha.telefone
          }
          titulo="Comunicar — Reserva Transfer"
          onGerarPDF={() => generateTransferPDF(comunicarTransferLinha.id)}
          webhookTipo="transfer_reserva"
          getConfirmacaoReservaPdfBase64={() => getTransferReservaPdfBase64(comunicarTransferLinha.id)}
        />
      )}

      {comunicarGrupoLinha && comunicarGrupoPayload && (
        <ComunicarDialog
          open={comunicarOpen && comunicarGrupoLinha != null}
          onOpenChange={(o) => {
            setComunicarOpen(o);
            if (!o) {
              setComunicarGrupoLinha(null);
              setComunicarGrupoPayload(null);
            }
          }}
          dados={comunicarGrupoPayload}
          telefone={
            typeof comunicarGrupoPayload.whatsapp === "string" && comunicarGrupoPayload.whatsapp.trim() !== ""
              ? comunicarGrupoPayload.whatsapp
              : comunicarGrupoLinha.whatsapp
          }
          titulo="Comunicar — Reserva de Grupo"
          onGerarPDF={() => generateGrupoPDF(comunicarGrupoLinha.id)}
          webhookTipo="grupo_reserva"
          getConfirmacaoReservaPdfBase64={() => getGrupoReservaPdfBase64(comunicarGrupoLinha.id)}
        />
      )}
    </div>
  );
}
