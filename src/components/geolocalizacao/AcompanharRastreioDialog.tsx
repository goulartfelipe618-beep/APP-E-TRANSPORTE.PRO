import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Eye, Loader2, MapPin, Radio } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import PainelGeolocalizador from "@/components/geolocalizacao/PainelGeolocalizador";
import type { Tables } from "@/integrations/supabase/types";

type RastreioRow = Tables<"rastreios_ao_vivo">;

type AcompanharRastreioDialogProps = {
  rastreio: RastreioRow | null;
  onClose: () => void;
  onStatusChanged?: () => void;
};

/**
 * Dialog do painel administrativo para acompanhar um rastreio em tempo real.
 *
 * **Papel SEMPRE = "central" (observador)**. O GPS do browser do administrador
 * NUNCA é ativado. A posição exibida vem do dispositivo do cliente — que
 * iniciou a viagem através do link público `/rastreio/:token` e autorizou a
 * geolocalização.
 *
 * Este comportamento garante os requisitos:
 *   - Apenas o usuário que iniciou a viagem tem localização rastreada.
 *   - O dono do SaaS apenas observa (somente leitura).
 */
export default function AcompanharRastreioDialog({
  rastreio,
  onClose,
  onStatusChanged,
}: AcompanharRastreioDialogProps) {
  /**
   * `open` do Radix desligado logo ao fechar, enquanto o pai ainda tem `rastreio`
   * até ao timeout — evita condição de corrida Leaflet↔portal (removeChild).
   */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mapMounted, setMapMounted] = useState(true);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (!rastreio?.id) {
      setDialogOpen(false);
      setMapMounted(false);
      return;
    }
    setDialogOpen(true);
    setMapMounted(true);
  }, [rastreio?.id]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    [],
  );

  const scheduleParentClose = () => {
    setDialogOpen(false);
    setMapMounted(false);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, 200);
  };

  // Subscrever para fechar automaticamente / notificar quando o dono encerra
  useEffect(() => {
    if (!rastreio?.id) return;
    const channel = supabase
      .channel(`acompanhar-rastreio-${rastreio.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rastreios_ao_vivo",
          filter: `id=eq.${rastreio.id}`,
        },
        (payload) => {
          const next = payload.new as Partial<RastreioRow>;
          if (next.status === "concluida" || next.status === "finalizado") {
            onStatusChanged?.();
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [rastreio?.id, onStatusChanged]);

  const clienteIniciou = rastreio?.iniciado_em_dispositivo != null;

  return (
    <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) scheduleParentClose(); }}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <MapPin className="h-4 w-4 text-[#FF6600]" />
            Acompanhar rastreio
            {rastreio?.cliente_nome && (
              <span className="text-muted-foreground font-normal text-sm">
                — {rastreio.cliente_nome}
              </span>
            )}
            <Badge variant="secondary" className="ml-2">
              <Eye className="h-3 w-3 mr-1" />
              Somente leitura
            </Badge>
            {clienteIniciou ? (
              <Badge className="ml-1 bg-[#FF6600] text-white hover:bg-[#FF6600]/90">
                <Radio className="h-3 w-3 mr-1" />
                Cliente transmitindo
              </Badge>
            ) : (
              <Badge variant="outline" className="ml-1 text-amber-600 border-amber-600/40">
                Aguardando cliente iniciar
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {clienteIniciou
              ? "O cliente iniciou a viagem e está transmitindo a localização dele. Você só visualiza — o seu GPS NÃO é usado."
              : "O cliente ainda não clicou em 'Iniciar viagem' no link enviado. Assim que iniciar, a posição aparecerá aqui em tempo real."}
          </DialogDescription>
        </DialogHeader>

        <div className="p-4">
          {!rastreio ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              A carregar…
            </div>
          ) : !mapMounted ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
              A fechar mapa…
            </div>
          ) : (
            <PainelGeolocalizador
              rastreioId={rastreio.id}
              papel="central"
              fullscreenOnMobile={false}
              heightPx={520}
            />
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end">
          <Button variant="outline" onClick={scheduleParentClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
