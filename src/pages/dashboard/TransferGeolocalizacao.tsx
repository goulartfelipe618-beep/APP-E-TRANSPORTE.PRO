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
  const [reservasTransfer, setReservasTransfer] = useState<ReservaTransfer[]>([]);
  const [reservasGrupos, setReservasGrupos] = useState<ReservaGrupo[]>([]);
  const [reservaKey, setReservaKey] = useState<string>("");

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
    }
  }, [open, loadReservas]);

  const totalReservas = reservasTransfer.length + reservasGrupos.length;

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
          <p className="text-muted-foreground">Gere links para rastrear a localização do cliente durante a viagem</p>
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
              <Select defaultValue="cliente">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="motorista">Motorista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nome (opcional)</Label><Input placeholder="Ex: João Silva" /></div>
            <div><Label>Telefone (opcional)</Label><Input placeholder="(__) _____-____" /></div>
            <div><Label>Observações (opcional)</Label><Textarea placeholder="Digite observações sobre o rastreamento..." /></div>
            <Button className="w-full" disabled={!reservaKey || loading}>
              Criar Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
