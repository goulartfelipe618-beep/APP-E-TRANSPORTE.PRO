import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, RefreshCw, Copy, Send, MapPin, Check,
  StopCircle, ExternalLink, Loader2, User, Car,
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
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import {
  dispatchComunicarWebhook,
  fetchMotoristaPainelSnapshot,
  jsonSafeRecord,
} from "@/lib/n8nComunicarWebhook";
import AcompanharRastreioDialog from "@/components/geolocalizacao/AcompanharRastreioDialog";

type ReservaTransfer = Tables<"reservas_transfer">;
type ReservaGrupo = Tables<"reservas_grupos">;
type RastreioRow = Tables<"rastreios_ao_vivo">;

function labelTransfer(r: ReservaTransfer) {
  const trajeto =
    r.ida_embarque && r.ida_desembarque
      ? `${r.ida_embarque} → ${r.ida_desembarque}`
      : r.ida_embarque || r.ida_desembarque || "—";
  const data = r.ida_data ? new Date(r.ida_data).toLocaleDateString("pt-BR") : "";
  return `#${r.numero_reserva} · ${r.nome_completo}${data ? ` · ${data}` : ""} · ${trajeto}`;
}

function labelGrupo(r: ReservaGrupo) {
  const rota = r.destino || r.embarque || "—";
  const data = r.data_ida ? new Date(r.data_ida).toLocaleDateString("pt-BR") : "";
  return `#${r.numero_reserva} · ${r.nome_completo}${data ? ` · ${data}` : ""} · ${rota}`;
}

function buildRastreioUrl(token: string): string {
  const envBase = (import.meta.env.VITE_APP_PUBLIC_URL as string | undefined)?.trim();
  const base = (envBase && envBase.length > 0 ? envBase.replace(/\/$/, "") : "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/rastreio/${token}`;
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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingRastreios, setLoadingRastreios] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reservasTransfer, setReservasTransfer] = useState<ReservaTransfer[]>([]);
  const [reservasGrupos, setReservasGrupos] = useState<ReservaGrupo[]>([]);
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

  const loadReservas = useCallback(async () => {
    setLoading(true);
    const [t, g] = await Promise.all([
      supabase.from("reservas_transfer").select("*").order("created_at", { ascending: false }),
      supabase.from("reservas_grupos").select("*").order("created_at", { ascending: false }),
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
    setLoading(false);
  }, []);

  const loadRastreios = useCallback(async () => {
    setLoadingRastreios(true);
    const { data, error } = await supabase
      .from("rastreios_ao_vivo")
      .select("*")
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

  // Auto-preenche nome/telefone ao escolher a reserva
  useEffect(() => {
    if (!reservaKey || reservaKey === "__empty__") return;
    const [kind, id] = reservaKey.split(":");
    if (kind === "transfer") {
      const r = reservasTransfer.find((x) => x.id === id);
      if (r) {
        if (!nomeOpcional.trim()) setNomeOpcional(r.nome_completo ?? "");
        if (!telefoneOpcional.trim()) setTelefoneOpcional(r.telefone ?? "");
      }
    } else if (kind === "grupo") {
      const r = reservasGrupos.find((x) => x.id === id);
      if (r) {
        if (!nomeOpcional.trim()) setNomeOpcional(r.nome_completo ?? "");
        if (!telefoneOpcional.trim()) setTelefoneOpcional(r.whatsapp ?? "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservaKey]);

  const totalReservas = reservasTransfer.length + reservasGrupos.length;

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

      const nomeCliente =
        nomeOpcional.trim() ||
        reservaTransfer?.nome_completo ||
        reservaGrupo?.nome_completo ||
        null;
      const telefoneCliente =
        telefoneOpcional.replace(/\D/g, "") ||
        (reservaTransfer?.telefone ?? "").replace(/\D/g, "") ||
        (reservaGrupo?.whatsapp ?? "").replace(/\D/g, "") ||
        null;

      const { data: inserted, error: insertErr } = await supabase
        .from("rastreios_ao_vivo")
        .insert({
          user_id: user.id,
          reserva_transfer_id: isTransfer ? id : null,
          reserva_grupo_id: !isTransfer ? id : null,
          cliente_nome: nomeCliente,
          cliente_telefone: telefoneCliente,
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
      const url = buildRastreioUrl(inserted.token);
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
      const url = buildRastreioUrl(r.token);
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

      await dispatchComunicarWebhook("geolocalizacao", {
        evento: "enviar_link_rastreamento",
        momento: new Date().toISOString(),
        rastreio_id: r.id,
        url_rastreio: url,
        token: r.token,
        tipo_reserva: tipoReserva,
        reserva_id: r.reserva_transfer_id || r.reserva_grupo_id || null,
        categoria_rastreamento: r.categoria_rastreamento,
        cliente_nome: r.cliente_nome,
        cliente_telefone: r.cliente_telefone,
        observacoes: r.observacoes,
        reserva: reservaSnapshot,
        motorista_painel: motorista,
      });

      const { error: updErr } = await supabase
        .from("rastreios_ao_vivo")
        .update({ comunicado_em: new Date().toISOString() })
        .eq("id", r.id);
      if (updErr) console.warn("Falha a marcar comunicado_em:", updErr.message);

      toast.success("Link enviado ao cliente pelo webhook.");
      void loadRastreios();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Falha ao comunicar o link.");
    } finally {
      setComunicandoId(null);
    }
  };

  const handleCopiar = async (r: RastreioRow) => {
    const url = buildRastreioUrl(r.token);
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
    () => rastreios.filter((r) => r.status === "concluida" || r.status === "finalizado").slice(0, 10),
    [rastreios],
  );

  return (
    <div className="space-y-6">
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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Geolocalização de Clientes</h1>
          <p className="text-muted-foreground">
            Crie um link de rastreio, envie ao cliente via WhatsApp (webhook n8n) e acompanhe o trajeto em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => { void loadRastreios(); }}
            disabled={loadingRastreios}
            title="Atualizar lista de rastreios"
          >
            <RefreshCw className={`h-4 w-4 ${loadingRastreios ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Link
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
            {rastreiosAtivos.map((r) => {
              const url = buildRastreioUrl(r.token);
              const st = statusLabel(r.status);
              const comunicandoAtual = comunicandoId === r.id;
              const encerrandoAtual = encerrandoId === r.id;
              return (
                <div key={r.id} className="py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground truncate">
                        {r.cliente_nome?.trim() || "Cliente sem nome"}
                      </span>
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
                      disabled={comunicandoAtual}
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
                      className="text-destructive hover:text-destructive"
                      onClick={() => setRastreioEncerrando(r)}
                      disabled={encerrandoAtual}
                      title="Encerrar e apagar rastro GPS"
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
      </div>

      {/* ======================================================= */}
      {/* Histórico curto                                          */}
      {/* ======================================================= */}
      {rastreiosHistorico.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-3">Histórico (últimos 10)</h3>
          <div className="divide-y divide-border">
            {rastreiosHistorico.map((r) => {
              const dt = r.data_hora_fim || r.finalizado_em || r.updated_at;
              return (
                <div key={r.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
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
                  <Badge variant="secondary">Concluído</Badge>
                </div>
              );
            })}
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
              <Select
                value={reservaKey}
                onValueChange={setReservaKey}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loading
                        ? "Carregando reservas..."
                        : totalReservas === 0
                          ? "Nenhuma reserva disponível"
                          : "Selecione uma reserva"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-[min(320px,70vh)]">
                  {!loading && totalReservas === 0 && (
                    <SelectItem value="__empty__" disabled>
                      Nenhuma reserva de transfer ou grupo — cadastre em Transfer / Grupos → Reservas
                    </SelectItem>
                  )}
                  {reservasTransfer.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Transfer</SelectLabel>
                      {reservasTransfer.map((r) => (
                        <SelectItem key={`t-${r.id}`} value={`transfer:${r.id}`}>
                          {labelTransfer(r)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {reservasGrupos.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Grupos</SelectLabel>
                      {reservasGrupos.map((r) => (
                        <SelectItem key={`g-${r.id}`} value={`grupo:${r.id}`}>
                          {labelGrupo(r)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
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
              <Label>Nome do cliente (opcional)</Label>
              <Input
                placeholder="Ex: João Silva"
                value={nomeOpcional}
                onChange={(e) => setNomeOpcional(e.target.value)}
              />
            </div>

            <div>
              <Label>Telefone do cliente (opcional)</Label>
              <Input
                placeholder="(__) _____-____"
                value={telefoneOpcional}
                onChange={(e) => setTelefoneOpcional(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Usado pelo n8n para enviar o link via WhatsApp.
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
              Esta ação marca o rastreio como <strong>concluído</strong>, remove os pontos GPS históricos e desativa o link público. O resumo da viagem (distância, duração) será preservado.
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
