import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Radio, ShieldAlert } from "lucide-react";
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
 * Dialog que acompanha um rastreio em tempo real.
 *
 * Se o utilizador atual é o dono (`user_id === rastreio.user_id`), actua como
 * `motorista` — o hook de GPS do device é activado e os dados são transmitidos
 * para a base de dados (RLS garante que só o dono pode escrever lat/lng).
 *
 * Caso contrário, actua como `central` — apenas visualiza.
 */
export default function AcompanharRastreioDialog({
  rastreio,
  onClose,
  onStatusChanged,
}: AcompanharRastreioDialogProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);

  useEffect(() => {
    if (!rastreio) return;
    setLoadingUser(true);
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
      setLoadingUser(false);
    })();
  }, [rastreio]);

  const papel: "motorista" | "central" | "cliente" = useMemo(() => {
    if (!rastreio || !currentUserId) return "central";
    return rastreio.user_id === currentUserId ? "motorista" : "central";
  }, [rastreio, currentUserId]);

  const open = !!rastreio;

  // Dispara refresh após concluir a corrida
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

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
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
            {papel === "motorista" && (
              <Badge className="ml-2 bg-[#FF6600] text-white hover:bg-[#FF6600]/90">
                <Radio className="h-3 w-3 mr-1" />
                Transmitindo GPS
              </Badge>
            )}
            {papel === "central" && (
              <Badge variant="secondary" className="ml-2">
                <ShieldAlert className="h-3 w-3 mr-1" />
                Central (somente leitura)
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {papel === "motorista"
              ? "Mantenha esta janela aberta no celular do motorista. A localização é enviada a cada 7 segundos enquanto a corrida estiver ativa."
              : "Visualização em tempo real. Apenas o motorista pode atualizar a posição."}
          </DialogDescription>
        </DialogHeader>

        <div className="p-4">
          {loadingUser || !rastreio ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              A carregar…
            </div>
          ) : (
            <PainelGeolocalizador
              rastreioId={rastreio.id}
              papel={papel}
              intervaloGpsMs={7000}
              fullscreenOnMobile={false}
              heightPx={520}
            />
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
