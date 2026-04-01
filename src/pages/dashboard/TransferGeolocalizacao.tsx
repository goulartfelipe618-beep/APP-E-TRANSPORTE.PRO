import { useState, useEffect, useCallback } from "react";
import { Plus, RefreshCw } from "lucide-react";
import SlideCarousel from "@/components/SlideCarousel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { dispatchComunicarWebhook, fetchMotoristaPainelSnapshot, jsonSafeRecord } from "@/lib/n8nComunicarWebhook";

type ReservaTransfer = Tables<"reservas_transfer">;
type ReservaGrupo = Tables<"reservas_grupos">;

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

export default function TransferGeolocalizacaoPage() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reservasTransfer, setReservasTransfer] = useState<ReservaTransfer[]>([]);
  const [reservasGrupos, setReservasGrupos] = useState<ReservaGrupo[]>([]);
  const [reservaKey, setReservaKey] = useState<string>("");
  const [categoria, setCategoria] = useState<"cliente" | "motorista">("cliente");
  const [nomeOpcional, setNomeOpcional] = useState("");
  const [telefoneOpcional, setTelefoneOpcional] = useState("");
  const [observacoes, setObservacoes] = useState("");

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

  useEffect(() => {
    loadReservas();
  }, [loadReservas]);

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

  const totalReservas = reservasTransfer.length + reservasGrupos.length;

  const handleCriarLink = async () => {
    if (!reservaKey || reservaKey === "__empty__") return;
    const parts = reservaKey.split(":");
    if (parts.length !== 2) return;
    const [kind, id] = parts as [string, string];
    const isTransfer = kind === "transfer";
    const reservaTransfer = isTransfer ? reservasTransfer.find((r) => r.id === id) : undefined;
    const reservaGrupo = !isTransfer ? reservasGrupos.find((r) => r.id === id) : undefined;
    const reservaSnapshot = reservaTransfer
      ? jsonSafeRecord(reservaTransfer as unknown as Record<string, unknown>)
      : reservaGrupo
        ? jsonSafeRecord(reservaGrupo as unknown as Record<string, unknown>)
        : {};

    setSubmitting(true);
    try {
      const motorista = await fetchMotoristaPainelSnapshot();
      await dispatchComunicarWebhook("geolocalizacao", {
        evento: "criar_link_rastreamento",
        momento: new Date().toISOString(),
        tipo_reserva: isTransfer ? "transfer" : "grupo",
        reserva_id: id,
        categoria_rastreamento: categoria,
        nome_opcional: nomeOpcional.trim() || null,
        telefone_opcional: telefoneOpcional.replace(/\D/g, "") || null,
        observacoes: observacoes.trim() || null,
        reserva: reservaSnapshot,
        motorista_painel: motorista,
      });
      toast.success("Dados enviados ao webhook de geolocalização.");
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Falha ao enviar ao webhook.");
    } finally {
      setSubmitting(false);
    }
  };

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
          <p className="text-muted-foreground">Envio dos dados de rastreamento apenas via webhook configurado em Admin → Comunicador</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Novo Link</Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3">Links de Rastreamento</h3>
        <p className="text-sm text-muted-foreground">Nenhum link de rastreamento criado.</p>
      </div>

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
              <Label>Categoria *</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as "cliente" | "motorista")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="motorista">Motorista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nome (opcional)</Label><Input placeholder="Ex: João Silva" value={nomeOpcional} onChange={(e) => setNomeOpcional(e.target.value)} /></div>
            <div><Label>Telefone (opcional)</Label><Input placeholder="(__) _____-____" value={telefoneOpcional} onChange={(e) => setTelefoneOpcional(e.target.value)} /></div>
            <div><Label>Observações (opcional)</Label><Textarea placeholder="Digite observações sobre o rastreamento..." value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
            <Button className="w-full" disabled={!reservaKey || loading || submitting} onClick={() => void handleCriarLink()}>
              {submitting ? "Enviando…" : "Criar Link"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
