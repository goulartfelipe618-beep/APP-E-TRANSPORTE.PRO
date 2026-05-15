import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, RefreshCw, Copy, Send, MapPin, Check,
  StopCircle, ExternalLink, Loader2, User, Car, Eye, Lock,
} from "lucide-react";
import SlideCarousel from "@/components/SlideCarousel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { useComunicadoresEvolution } from "@/hooks/useComunicadoresEvolution";
import {
  buildComunicadorSnapshot,
  buildN8nEnvioWhatsappCampos,
  dispatchComunicarWebhook,
  fetchMotoristaPainelSnapshot,
  jsonSafeRecord,
} from "@/lib/n8nComunicarWebhook";
import AcompanharRastreioDialog from "@/components/geolocalizacao/AcompanharRastreioDialog";
import DetalhesViagemRastreioSheet from "@/components/geolocalizacao/DetalhesViagemRastreioSheet";
import { buildRastreioShareUrl } from "@/lib/appPublicUrl";
import { formatDbCalendarDatePtBr, toAgendaDayKey } from "@/lib/painelAgendaReservas";
import { normalizeUserPlano, FREE_MAX_LINKS_GEO_MES } from "@/lib/painelPlanPolicy";
import { currentYearMonthKeySaoPaulo, yearMonthKeySaoPauloFromIso } from "@/lib/spCalendarBr";
import { useUserPlan } from "@/hooks/useUserPlan";
import { freePlanLockedRastreioIdsByCreationMonth } from "@/lib/freePlanLocks";
import { usePainelListPagination } from "@/hooks/usePainelListPagination";
import { PainelPaginationBar } from "@/components/painel/PainelPaginationBar";
import {
  isCategoriaMotorista,
  type MotoristaFrotaOpt,
  resolveDestinatarioAoCriar,
  resolveDestinatarioComunicar,
} from "@/lib/rastreioDestinatario";

type ReservaTransfer = Tables<"reservas_transfer">;
type ReservaGrupo = Tables<"reservas_grupos">;
type RastreioRow = Tables<"rastreios_ao_vivo">;

function labelTransfer(r: ReservaTransfer) {
  const trajeto =
    r.ida_embarque && r.ida_desembarque
      ? `${r.ida_embarque} → ${r.ida_desembarque}`
      : r.ida_embarque || r.ida_desembarque || "—";
  const dataFmt = formatDbCalendarDatePtBr(r.ida_data);
  const data = dataFmt === "—" ? "" : dataFmt;
  return `#${r.numero_reserva} · ${r.nome_completo}${data ? ` · ${data}` : ""} · ${trajeto}`;
}

function labelGrupo(r: ReservaGrupo) {
  const rota = r.destino || r.embarque || "—";
  const dataFmt = formatDbCalendarDatePtBr(r.data_ida);
  const data = dataFmt === "—" ? "" : dataFmt;
  return `#${r.numero_reserva} · ${r.nome_completo}${data ? ` · ${data}` : ""} · ${rota}`;
}

/** Normaliza valor da BD para YYYY-MM-DD (calendário; evita interpretação UTC em strings só-data). */
function parseYmdFromDb(v: string | null | undefined): string | null {
  return toAgendaDayKey(v);
}

function parseHm(hora: string | null | undefined): { h: number; m: number } | null {
  if (!hora) return null;
  const s = String(hora).trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

/**
 * true se a data/hora de início do serviço ainda não passou no calendário local:
 * — dia futuro; ou — mesmo dia sem hora (considera o dia ainda elegível); ou — mesmo dia com hora > agora.
 */
function instanteAindaPorVir(dataRaw: string | null | undefined, hora: string | null | undefined, now: Date): boolean {
  const ymd = parseYmdFromDb(dataRaw);
  if (!ymd) return false;
  const [y, mo, d] = ymd.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return false;
  const dayStart = new Date(y, mo - 1, d, 0, 0, 0, 0);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  if (dayStart.getTime() > todayStart.getTime()) return true;
  if (dayStart.getTime() < todayStart.getTime()) return false;
  const hm = parseHm(hora);
  if (!hm) return true;
  const scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hm.h, hm.m, 0, 0);
  return scheduled.getTime() > now.getTime();
}

function reservaTransferTemAgendaFutura(r: ReservaTransfer, now: Date): boolean {
  const tvRaw = (r.tipo_viagem ?? "").trim();
  const tv = tvRaw === "ida" ? "somente_ida" : tvRaw;
  if (tv === "por_hora") {
    return instanteAindaPorVir(r.por_hora_data, r.por_hora_hora, now);
  }
  const idaOk = instanteAindaPorVir(r.ida_data, r.ida_hora, now);
  if (tv === "ida_volta") {
    const voltaOk = instanteAindaPorVir(r.volta_data, r.volta_hora, now);
    return idaOk || voltaOk;
  }
  return idaOk;
}

function reservaGrupoTemAgendaFutura(r: ReservaGrupo, now: Date): boolean {
  const idaOk = instanteAindaPorVir(r.data_ida, r.hora_ida, now);
  const dataRet = parseYmdFromDb(r.data_retorno) ?? parseYmdFromDb(r.data_ida);
  const voltaOk = instanteAindaPorVir(dataRet, r.hora_retorno, now);
  return idaOk || voltaOk;
}

function statusLabel(status: string | null | undefined): { label: string; tone: "on" | "off" | "idle" } {
  switch (status) {
    case "ativo":
      return { label: "Ao vivo", tone: "on" };
    case "pausado":
      return { label: "Pausado", tone: "idle" };
    case "concluida":
    case "finalizado":
      return { label: "Concluído", tone: "off" };
    default:
      return { label: status ?? "—", tone: "idle" };
  }
}

export default function TransferGeolocalizacaoPage() {
  const { sistema, own } = useComunicadoresEvolution();
  const { plano, loading: planUserPlanLoading } = useUserPlan();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingRastreios, setLoadingRastreios] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reservasTransfer, setReservasTransfer] = useState<ReservaTransfer[]>([]);
  const [reservasGrupos, setReservasGrupos] = useState<ReservaGrupo[]>([]);
  const [motoristasFrota, setMotoristasFrota] = useState<MotoristaFrotaOpt[]>([]);
  const [rastreios, setRastreios] = useState<RastreioRow[]>([]);
  const [reservaKey, setReservaKey] = useState<string>("");
  const [categoria, setCategoria] = useState<"cliente" | "motorista">("cliente");
  const [nomeOpcional, setNomeOpcional] = useState("");
  const [telefoneOpcional, setTelefoneOpcional] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [rastreioAcompanhando, setRastreioAcompanhando] = useState<RastreioRow | null>(null);
  const [rastreioEncerrando, setRastreioEncerrando] = useState<RastreioRow | null>(null);
  const [comunicandoId, setComunicandoId] = useState<string | null>(null);
  const [encerrandoId, setEncerrandoId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [detalheRastreio, setDetalheRastreio] = useState<RastreioRow | null>(null);

  const loadReservas = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setReservasTransfer([]);
      setReservasGrupos([]);
      setMotoristasFrota([]);
      setLoading(false);
      return;
    }
    const filtroDonoOuMotorista = `user_id.eq.${uid},motorista_id.eq.${uid}`;
    const [t, g, mot] = await Promise.all([
      supabase.from("reservas_transfer").select("*").or(filtroDonoOuMotorista).order("created_at", { ascending: false }),
      supabase.from("reservas_grupos").select("*").or(filtroDonoOuMotorista).order("created_at", { ascending: false }),
      supabase
        .from("solicitacoes_motoristas")
        .select("nome, telefone, portal_auth_user_id")
        .eq("user_id", uid)
        .eq("status", "cadastrado")
        .not("portal_auth_user_id", "is", null),
    ]);
    if (t.error) {
      toast.error("Erro ao carregar reservas de transfer");
    } else {
      setReservasTransfer(t.data || []);
    }
    if (g.error) {
      toast.error("Erro ao carregar reservas de grupos");
    } else {
      setReservasGrupos(g.data || []);
    }
    if (!mot.error && mot.data) {
      setMotoristasFrota(
        (mot.data as { portal_auth_user_id: string | null; nome: string; telefone: string | null }[])
          .filter((m) => m.portal_auth_user_id != null)
          .map((m) => ({
            portalAuthUserId: m.portal_auth_user_id as string,
            nome: m.nome,
            telefone: m.telefone,
          })),
      );
    } else {
      setMotoristasFrota([]);
    }
    setLoading(false);
  }, []);

  const loadRastreios = useCallback(async () => {
    setLoadingRastreios(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setRastreios([]);
      setLoadingRastreios(false);
      return;
    }
    const { data, error } = await supabase
      .from("rastreios_ao_vivo")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error("Erro ao carregar links de rastreamento.");
      setRastreios([]);
    } else {
      setRastreios(data ?? []);
    }
    setLoadingRastreios(false);
  }, []);

  useEffect(() => {
    loadReservas();
    loadRastreios();
  }, [loadReservas, loadRastreios]);

  useEffect(() => {
    if (open) {
      loadReservas();
      setReservaKey("");
      setCategoria("cliente");
      setNomeOpcional("");
      setTelefoneOpcional("");
      setObservacoes("");
    }
  }, [open, loadReservas]);

  // Auto-preenche nome/telefone ao escolher a reserva ou mudar cliente/motorista
  useEffect(() => {
    if (!reservaKey || reservaKey === "__empty__") return;
    const [kind, id] = reservaKey.split(":");
    if (kind === "transfer") {
      const r = reservasTransfer.find((x) => x.id === id);
      if (!r) return;
      if (categoria === "motorista") {
        const dest = resolveDestinatarioAoCriar({
          categoria: "motorista",
          nomeOpcional: "",
          telefoneOpcional: "",
          reservaTransfer: r,
          motoristasFrota,
        });
        setNomeOpcional(dest.nome ?? "");
        setTelefoneOpcional(dest.telefone ?? "");
      } else {
        setNomeOpcional(r.nome_completo ?? "");
        setTelefoneOpcional(r.telefone ?? "");
      }
    } else if (kind === "grupo") {
      const r = reservasGrupos.find((x) => x.id === id);
      if (!r) return;
      if (categoria === "motorista") {
        const dest = resolveDestinatarioAoCriar({
          categoria: "motorista",
          nomeOpcional: "",
          telefoneOpcional: "",
          reservaGrupo: r,
          motoristasFrota,
        });
        setNomeOpcional(dest.nome ?? "");
        setTelefoneOpcional(dest.telefone ?? "");
      } else {
        setNomeOpcional(r.nome_completo ?? "");
        setTelefoneOpcional(r.whatsapp ?? "");
      }
    }
  }, [reservaKey, categoria, reservasTransfer, reservasGrupos, motoristasFrota]);

  const reservasTransferFuturas = useMemo(() => {
    const now = new Date();
    return reservasTransfer.filter((r) => reservaTransferTemAgendaFutura(r, now));
  }, [reservasTransfer, open]);

  const reservasGruposFuturas = useMemo(() => {
    const now = new Date();
    return reservasGrupos.filter((r) => reservaGrupoTemAgendaFutura(r, now));
  }, [reservasGrupos, open]);

  const totalReservasFuturas = reservasTransferFuturas.length + reservasGruposFuturas.length;

  /**
   * Cria o rastreio na base de dados (token gerado automaticamente por default).
   * NÃO dispara webhook — apenas cria a linha e a URL pública. O envio ao cliente
   * é uma ação separada ("Comunicar") para que o admin possa rever a mensagem
   * antes de disparar ao n8n/WhatsApp.
   */
  const handleCriarLink = async () => {
    if (!reservaKey || reservaKey === "__empty__") return;
    const parts = reservaKey.split(":");
    if (parts.length !== 2) return;
    const [kind, id] = parts as [string, string];
    const isTransfer = kind === "transfer";
    const reservaTransfer = isTransfer ? reservasTransfer.find((r) => r.id === id) : undefined;
    const reservaGrupo = !isTransfer ? reservasGrupos.find((r) => r.id === id) : undefined;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");

      const { data: up } = await supabase.from("user_plans").select("plano").eq("user_id", user.id).maybeSingle();
      const p = normalizeUserPlano(up?.plano);
      if (p === "free") {
        const since = new Date(Date.now() - 62 * 24 * 60 * 60 * 1000).toISOString();
        const { data: geoRows, error: geoErr } = await supabase
          .from("rastreios_ao_vivo")
          .select("created_at")
          .eq("user_id", user.id)
          .gte("created_at", since);
        if (geoErr) {
          throw new Error("Não foi possível validar o limite mensal de links.");
        }
        const ym = currentYearMonthKeySaoPaulo();
        const countMes = (geoRows ?? []).filter((r) => yearMonthKeySaoPauloFromIso(r.created_at) === ym).length;
        if (countMes >= FREE_MAX_LINKS_GEO_MES) {
          throw new Error(
            `Plano FREE: no máximo ${FREE_MAX_LINKS_GEO_MES} links de rastreamento por mês. Faça upgrade para STANDART ou PRÓ.`,
          );
        }
      }

      const destinatario = resolveDestinatarioAoCriar({
        categoria,
        nomeOpcional,
        telefoneOpcional,
        reservaTransfer,
        reservaGrupo,
        motoristasFrota,
      });

      const { data: inserted, error: insertErr } = await supabase
        .from("rastreios_ao_vivo")
        .insert({
          user_id: user.id,
          reserva_transfer_id: isTransfer ? id : null,
          reserva_grupo_id: !isTransfer ? id : null,
          cliente_nome: destinatario.nome,
          cliente_telefone: destinatario.telefone,
          observacoes: observacoes.trim() || null,
          categoria_rastreamento: categoria,
          status: "ativo",
        })
        .select()
        .single();

      if (insertErr || !inserted) {
        throw new Error(insertErr?.message || "Falha ao criar o rastreio.");
      }

      // Otimista: copia URL para área de transferência
      const url = buildRastreioShareUrl(inserted.token);
      try { await navigator.clipboard?.writeText(url); } catch { /* noop */ }

      toast.success("Link criado! URL copiada para a área de transferência.");
      // Reset os Selects ANTES de fechar o Dialog para libertar os portais Radix
      // (evita "Failed to execute removeChild on Node" quando o parent re-renderiza
      // durante a animação de fecho do DialogContent).
      setReservaKey("");
      setCategoria("cliente");
      setNomeOpcional("");
      setTelefoneOpcional("");
      setObservacoes("");
      setOpen(false);
      // Adia o reload para depois do Dialog terminar a animação de saída,
      // evitando re-renderizar enquanto o Radix está a desmontar portais.
      window.setTimeout(() => {
        void loadRastreios();
      }, 250);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Falha ao criar o rastreio.");
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Dispara o webhook de geolocalização para o n8n. O n8n tipicamente encaminha
   * a URL gerada para o WhatsApp do cliente. Só é acionado ao clicar em
   * "Comunicar" — não na criação do link.
   */
  const handleComunicar = async (r: RastreioRow) => {
    setComunicandoId(r.id);
    try {
      const url = buildRastreioShareUrl(r.token);
      const motorista = await fetchMotoristaPainelSnapshot();

      let reservaSnapshot: Record<string, unknown> = {};
      let tipoReserva: "transfer" | "grupo" | "avulso" = "avulso";
      if (r.reserva_transfer_id) {
        tipoReserva = "transfer";
        const { data } = await supabase
          .from("reservas_transfer")
          .select("*")
          .eq("id", r.reserva_transfer_id)
          .maybeSingle();
        if (data) reservaSnapshot = jsonSafeRecord(data as unknown as Record<string, unknown>);
      } else if (r.reserva_grupo_id) {
        tipoReserva = "grupo";
        const { data } = await supabase
          .from("reservas_grupos")
          .select("*")
          .eq("id", r.reserva_grupo_id)
          .maybeSingle();
        if (data) reservaSnapshot = jsonSafeRecord(data as unknown as Record<string, unknown>);
      }

      const destinatario = resolveDestinatarioComunicar({
        categoria: r.categoria_rastreamento,
        clienteNome: r.cliente_nome,
        clienteTelefone: r.cliente_telefone,
        reservaSnapshot,
        motoristasFrota,
      });

      if (!destinatario.telefone) {
        throw new Error(
          isCategoriaMotorista(r.categoria_rastreamento)
            ? "Sem telefone do motorista na reserva. Atribua um motorista com telefone cadastrado ou preencha o campo ao criar o link."
            : "Sem telefone do cliente para enviar o link.",
        );
      }

      const mensagemGeo = `Acompanhe em tempo real: ${url}`;
      const comunicadorSnap = buildComunicadorSnapshot(sistema, own);
      await dispatchComunicarWebhook("geolocalizacao", {
        evento: "enviar_link_rastreamento",
        momento: new Date().toISOString(),
        rastreio_id: r.id,
        url_rastreio: url,
        token: r.token,
        tipo_reserva: tipoReserva,
        reserva_id: r.reserva_transfer_id || r.reserva_grupo_id || null,
        categoria_rastreamento: r.categoria_rastreamento,
        cliente_nome: destinatario.nome,
        cliente_telefone: destinatario.telefone,
        destinatario_nome: destinatario.nome,
        destinatario_telefone: destinatario.telefone,
        observacoes: r.observacoes,
        reserva: reservaSnapshot,
        motorista_painel: motorista,
        comunicador: comunicadorSnap,
        ...buildN8nEnvioWhatsappCampos(comunicadorSnap, destinatario.telefone, {
          mensagem: mensagemGeo,
          tipo: "geolocalizacao",
        }),
      });

      const { error: updErr } = await supabase
        .from("rastreios_ao_vivo")
        .update({
          comunicado_em: new Date().toISOString(),
          cliente_nome: destinatario.nome,
          cliente_telefone: destinatario.telefone,
        })
        .eq("id", r.id);
      if (updErr) console.warn("Falha a marcar comunicado_em:", updErr.message);

      toast.success(
        isCategoriaMotorista(r.categoria_rastreamento)
          ? "Link enviado ao motorista pelo webhook."
          : "Link enviado ao cliente pelo webhook.",
      );
      void loadRastreios();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Falha ao comunicar o link.");
    } finally {
      setComunicandoId(null);
    }
  };

  const handleCopiar = async (r: RastreioRow) => {
    const url = buildRastreioShareUrl(r.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(r.id);
      toast.success("URL copiada.");
      window.setTimeout(() => setCopiedId((prev) => (prev === r.id ? null : prev)), 1500);
    } catch {
      toast.error("Não foi possível copiar a URL.");
    }
  };

  const handleEncerrarConfirmar = async () => {
    if (!rastreioEncerrando) return;
    setEncerrandoId(rastreioEncerrando.id);
    try {
      const { error } = await supabase.rpc("encerrar_rastreio", {
        p_rastreio_id: rastreioEncerrando.id,
        p_origem: null,
        p_destino: null,
        p_valor_total: null,
        p_distancia_km: null,
        p_duracao_segundos: null,
      });
      if (error) throw error;
      toast.success("Rastreio encerrado.");
      setRastreioEncerrando(null);
      // Adia o reload para depois do AlertDialog fechar (evita removeChild do Radix).
      window.setTimeout(() => {
        void loadRastreios();
      }, 250);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Falha ao encerrar o rastreio.");
    } finally {
      setEncerrandoId(null);
    }
  };

  const rastreiosAtivos = useMemo(
    () => rastreios.filter((r) => r.status !== "concluida" && r.status !== "finalizado"),
    [rastreios],
  );
  const rastreiosHistorico = useMemo(
    () => rastreios.filter((r) => r.status === "concluida" || r.status === "finalizado"),
    [rastreios],
  );

  const { slice: rastreiosAtivosPage, page: pageAtivos, setPage: setPageAtivos, totalPages: tpAtivos, totalItems: tiAtivos } =
    usePainelListPagination(rastreiosAtivos);
  const {
    slice: rastreiosHistoricoPage,
    page: pageHistorico,
    setPage: setPageHistorico,
    totalPages: tpHistorico,
    totalItems: tiHistorico,
  } = usePainelListPagination(rastreiosHistorico);

  const geoLockedIds = useMemo(
    () => freePlanLockedRastreioIdsByCreationMonth(plano, rastreios.map((r) => ({ id: r.id, created_at: r.created_at }))),
    [plano, rastreios],
  );

  const freeGeoMonthAtCap = useMemo(() => {
    if (plano !== "free" || planUserPlanLoading) return false;
    const ym = currentYearMonthKeySaoPaulo();
    const n = rastreios.filter((r) => yearMonthKeySaoPauloFromIso(r.created_at) === ym).length;
    return n >= FREE_MAX_LINKS_GEO_MES;
  }, [plano, planUserPlanLoading, rastreios]);

  return (
    <div className="min-w-0 space-y-6">
      <SlideCarousel
        pagina="geolocalizacao"
        fallbackSlides={[
          {
            titulo: "Geolocalização",
            subtitulo: "Links de rastreamento e localização durante o transfer",
            mostrar_texto: true,
          },
        ]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Geolocalização de Clientes</h1>
          <p className="text-pretty break-words text-muted-foreground">
            Crie um link de rastreio, envie ao cliente via WhatsApp (webhook n8n) e acompanhe o trajeto em tempo real.
            {!planUserPlanLoading && geoLockedIds.size > 0 ? (
              <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400 sm:ml-2 sm:mt-0 sm:inline">
                Alguns links excedem o limite mensal do plano FREE: continuam listados, mas só os primeiros três do mês
                podem ser usados até renovar o plano. Os dados não são apagados.
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:justify-end">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0 sm:h-9 sm:w-9"
            onClick={() => {
              void loadRastreios();
            }}
            disabled={loadingRastreios}
            title="Atualizar lista de rastreios"
            aria-label="Atualizar lista de rastreios"
          >
            <RefreshCw className={`h-4 w-4 ${loadingRastreios ? "animate-spin" : ""}`} />
          </Button>
          <Button
            className="min-h-10 flex-1 sm:min-h-9 sm:flex-initial"
            onClick={() => setOpen(true)}
            disabled={!planUserPlanLoading && freeGeoMonthAtCap}
            title={freeGeoMonthAtCap ? `Plano FREE: máximo de ${FREE_MAX_LINKS_GEO_MES} links no mês civil (SP).` : undefined}
          >
            <Plus className="mr-2 h-4 w-4 shrink-0" /> Novo Link
          </Button>
        </div>
      </div>

      {/* ======================================================= */}
      {/* Lista de rastreios ativos                                */}
      {/* ======================================================= */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Links Ativos</h3>
          <span className="text-xs text-muted-foreground">
            {rastreiosAtivos.length} {rastreiosAtivos.length === 1 ? "rastreio" : "rastreios"}
          </span>
        </div>

        {loadingRastreios && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            A carregar…
          </div>
        )}

        {!loadingRastreios && rastreiosAtivos.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum link de rastreamento ativo. Clique em <strong>Novo Link</strong> para criar.
          </p>
        )}

        {!loadingRastreios && rastreiosAtivos.length > 0 && (
          <div className="divide-y divide-border">
            {rastreiosAtivosPage.map((r) => {
              const url = buildRastreioShareUrl(r.token);
              const st = statusLabel(r.status);
              const comunicandoAtual = comunicandoId === r.id;
              const encerrandoAtual = encerrandoId === r.id;
              const rowLocked = !planUserPlanLoading && geoLockedIds.has(r.id);
              return (
                <div key={r.id} className={cn("py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between", rowLocked && "rounded-lg bg-muted/20 opacity-[0.55]")}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">
                        {r.cliente_nome?.trim() ||
                          (isCategoriaMotorista(r.categoria_rastreamento) ? "Motorista sem nome" : "Cliente sem nome")}
                      </span>
                      {rowLocked ? (
                        <Badge variant="outline" className="gap-1 border-amber-600/40 text-[11px] text-amber-700 dark:text-amber-400">
                          <Lock className="h-3 w-3" />
                          FREE
                        </Badge>
                      ) : null}
                      <Badge
                        variant={st.tone === "on" ? "default" : "secondary"}
                        className={
                          st.tone === "on"
                            ? "bg-[#FF6600] text-white hover:bg-[#FF6600]/90"
                            : undefined
                        }
                      >
                        {st.label}
                      </Badge>
                      {r.categoria_rastreamento && (
                        <Badge variant="outline" className="text-xs">
                          {r.categoria_rastreamento === "cliente" ? "Cliente" : "Motorista"}
                        </Badge>
                      )}
                      {r.comunicado_em ? (
                        <span className="text-[11px] text-muted-foreground">
                          Enviado {new Date(r.comunicado_em).toLocaleString("pt-BR")}
                        </span>
                      ) : (
                        <span className="text-[11px] text-yellow-600 dark:text-yellow-400">
                          Ainda não comunicado
                        </span>
                      )}
                      {r.iniciado_em_dispositivo ? (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                          · Cliente iniciou {new Date(r.iniciado_em_dispositivo).toLocaleTimeString("pt-BR")}
                        </span>
                      ) : st.tone === "on" ? (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400">
                          · Aguardando cliente iniciar
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate" title={url}>{url}</span>
                    </div>
                    {r.cliente_telefone && (
                      <div className="text-xs text-muted-foreground">
                        Tel: {r.cliente_telefone}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={rowLocked}
                      onClick={() => void handleCopiar(r)}
                      title="Copiar URL"
                    >
                      {copiedId === r.id ? (
                        <Check className="h-4 w-4 mr-1" />
                      ) : (
                        <Copy className="h-4 w-4 mr-1" />
                      )}
                      {copiedId === r.id ? "Copiado" : "Copiar"}
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={rowLocked}
                      onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                      title="Abrir página pública do cliente"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Abrir
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      className="bg-[#FF6600] hover:bg-[#FF6600]/90 text-white"
                      onClick={() => void handleComunicar(r)}
                      disabled={comunicandoAtual || rowLocked}
                      title="Enviar link via webhook (n8n → WhatsApp)"
                    >
                      {comunicandoAtual ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-1" />
                      )}
                      Comunicar
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={rowLocked}
                      onClick={() => setRastreioAcompanhando(r)}
                      title="Acompanhar em tempo real (motorista/central)"
                    >
                      <MapPin className="h-4 w-4 mr-1" />
                      Acompanhar
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setDetalheRastreio(r)}
                      title="Ver distância, tempo e coordenadas (só os seus links)"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Detalhes
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setRastreioEncerrando(r)}
                      disabled={encerrandoAtual || rowLocked}
                      title="Encerrar viagem e compactar GPS"
                    >
                      <StopCircle className="h-4 w-4 mr-1" />
                      Encerrar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!loadingRastreios && rastreiosAtivos.length > 0 ? (
          <div className="border-t border-border px-4 pb-4 pt-3">
            <PainelPaginationBar
              page={pageAtivos}
              totalPages={tpAtivos}
              totalItems={tiAtivos}
              onPageChange={setPageAtivos}
            />
          </div>
        ) : null}
      </div>

      {/* ======================================================= */}
      {/* Histórico curto                                          */}
      {/* ======================================================= */}
      {rastreiosHistorico.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-3">Histórico</h3>
          <div className="divide-y divide-border">
            {rastreiosHistoricoPage.map((r) => {
              const dt = r.data_hora_fim || r.finalizado_em || r.updated_at;
              const rowLocked = !planUserPlanLoading && geoLockedIds.has(r.id);
              return (
                <div key={r.id} className={cn("py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", rowLocked && "opacity-50")}>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-foreground truncate">
                      {r.cliente_nome?.trim() || "—"}
                      {r.distancia_total_km != null && (
                        <span className="text-muted-foreground"> · {Number(r.distancia_total_km).toFixed(2)} km</span>
                      )}
                      {r.duracao_segundos != null && (
                        <span className="text-muted-foreground"> · {Math.round(r.duracao_segundos / 60)} min</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {dt ? new Date(dt).toLocaleString("pt-BR") : "—"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => setDetalheRastreio(r)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Detalhes
                    </Button>
                    <Badge variant="secondary">Concluído</Badge>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-border pt-3">
            <PainelPaginationBar
              page={pageHistorico}
              totalPages={tpHistorico}
              totalItems={tiHistorico}
              onPageChange={setPageHistorico}
            />
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* Dialog: Criar Novo Link                                  */}
      {/* ======================================================= */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar Link de Rastreamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <Label>Reserva (Transfer ou Grupo) *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => loadReservas()}
                  disabled={loading}
                  title="Atualizar lista"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
              {/*
                Select Radix + Dialog = portal/focus-scope quebrava a lista (insertBefore/removeChild)
                e impedia escolher a reserva. <select> nativo fica dentro do mesmo DOM do Dialog.
              */}
              <select
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50 max-w-full",
                )}
                value={reservaKey || ""}
                onChange={(e) => setReservaKey(e.target.value)}
                disabled={loading || totalReservasFuturas === 0}
                aria-label="Reserva (Transfer ou Grupo)"
              >
                <option value="">
                  {loading
                    ? "Carregando reservas…"
                    : totalReservasFuturas === 0
                      ? "Nenhuma reserva futura — cadastre em Transfer / Grupos → Reservas"
                      : "Selecione uma reserva"}
                </option>
                {reservasTransferFuturas.length > 0 ? (
                  <optgroup label="Transfer">
                    {reservasTransferFuturas.map((r) => (
                      <option key={`t-${r.id}`} value={`transfer:${r.id}`}>
                        {labelTransfer(r)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {reservasGruposFuturas.length > 0 ? (
                  <optgroup label="Grupos">
                    {reservasGruposFuturas.map((r) => (
                      <option key={`g-${r.id}`} value={`grupo:${r.id}`}>
                        {labelGrupo(r)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Só entram viagens com data e hora de <strong className="text-foreground">ida</strong>,{" "}
                <strong className="text-foreground">volta</strong> ou serviço{" "}
                <strong className="text-foreground">por hora</strong> ainda por ocorrer (inclui hoje com horário
                posterior). Reservas já concluídas no tempo não aparecem.
              </p>
            </div>

            <div>
              <Label>Quem é rastreado *</Label>
              {/*
                Substituímos o <Select> por dois cartões radio para evitar
                o bug "removeChild" do Radix UI: um <Select> dentro de um
                <Dialog> abre um portal aninhado que entra em condição de
                race com o focus-scope do Dialog ao montar. Como aqui só
                há 2 opções fixas, dois botões resolvem definitivamente
                o problema e melhoram a UX.
              */}
              <div
                role="radiogroup"
                aria-label="Quem é rastreado"
                className="grid grid-cols-2 gap-2 mt-1"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={categoria === "cliente"}
                  onClick={() => setCategoria("cliente")}
                  className={`flex items-start gap-2 rounded-md border p-3 text-left transition-colors ${
                    categoria === "cliente"
                      ? "border-orange-500 bg-orange-500/10 text-foreground"
                      : "border-border bg-background hover:border-orange-500/50 hover:bg-accent text-muted-foreground"
                  }`}
                >
                  <User
                    className={`h-4 w-4 mt-0.5 shrink-0 ${
                      categoria === "cliente" ? "text-orange-500" : ""
                    }`}
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">Cliente</span>
                    <span className="text-[11px] text-muted-foreground">
                      Celular do passageiro
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={categoria === "motorista"}
                  onClick={() => setCategoria("motorista")}
                  className={`flex items-start gap-2 rounded-md border p-3 text-left transition-colors ${
                    categoria === "motorista"
                      ? "border-orange-500 bg-orange-500/10 text-foreground"
                      : "border-border bg-background hover:border-orange-500/50 hover:bg-accent text-muted-foreground"
                  }`}
                >
                  <Car
                    className={`h-4 w-4 mt-0.5 shrink-0 ${
                      categoria === "motorista" ? "text-orange-500" : ""
                    }`}
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">Motorista</span>
                    <span className="text-[11px] text-muted-foreground">
                      Celular do condutor
                    </span>
                  </span>
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                O <strong>motorista</strong> transmite GPS enquanto a tela estiver aberta em “Acompanhar”. Em modo <strong>cliente</strong> o GPS vem do próprio passageiro (futuro).
              </p>
            </div>

            <div>
              <Label>{categoria === "motorista" ? "Nome do motorista (opcional)" : "Nome do cliente (opcional)"}</Label>
              <Input
                placeholder={categoria === "motorista" ? "Ex: Carlos Motorista" : "Ex: João Silva"}
                value={nomeOpcional}
                onChange={(e) => setNomeOpcional(e.target.value)}
              />
            </div>

            <div>
              <Label>{categoria === "motorista" ? "Telefone do motorista (opcional)" : "Telefone do cliente (opcional)"}</Label>
              <Input
                placeholder="(__) _____-____"
                value={telefoneOpcional}
                onChange={(e) => setTelefoneOpcional(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {categoria === "motorista"
                  ? "Usado pelo n8n para enviar o link ao motorista via WhatsApp."
                  : "Usado pelo n8n para enviar o link ao cliente via WhatsApp."}
              </p>
            </div>

            <div>
              <Label>Observações (opcional)</Label>
              <Textarea
                placeholder="Notas internas para a central ou motorista…"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              disabled={!reservaKey || loading || submitting}
              onClick={() => void handleCriarLink()}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando…
                </>
              ) : (
                "Criar Link"
              )}
            </Button>

            <p className="text-[11px] text-muted-foreground">
              O link é criado e a URL pública é copiada para a sua área de transferência. Para enviar ao cliente, clique em <strong>Comunicar</strong> na lista de links.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ======================================================= */}
      {/* Dialog: Acompanhar em tempo real                         */}
      {/* ======================================================= */}
      <AcompanharRastreioDialog
        rastreio={rastreioAcompanhando}
        onClose={() => setRastreioAcompanhando(null)}
        onStatusChanged={() => {
          void loadRastreios();
        }}
      />

      <DetalhesViagemRastreioSheet
        rastreio={detalheRastreio}
        open={detalheRastreio !== null}
        onOpenChange={(o) => {
          if (!o) setDetalheRastreio(null);
        }}
      />

      {/* ======================================================= */}
      {/* Dialog: Confirmar Encerramento                           */}
      {/* ======================================================= */}
      <AlertDialog
        open={!!rastreioEncerrando}
        onOpenChange={(o) => !o && setRastreioEncerrando(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar rastreio?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma o encerramento? O rastreio fica <strong>concluído</strong>. São guardadas as coordenadas de
              início e fim, distância e tempo; os pontos GPS intermédios são removidos. Só a sua conta vê os detalhes
              deste link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!encerrandoId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleEncerrarConfirmar();
              }}
              disabled={!!encerrandoId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {encerrandoId ? "Encerrando…" : "Encerrar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
