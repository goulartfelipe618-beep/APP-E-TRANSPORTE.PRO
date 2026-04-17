import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Loader2, MapPin, Radio, RefreshCw,
  ShieldAlert, XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import PainelGeolocalizador from "@/components/geolocalizacao/PainelGeolocalizador";
import type { MotoristaGPSBroadcastState } from "@/hooks/useMotoristaGPSBroadcast";
import type { Tables } from "@/integrations/supabase/types";

type RastreioRow = Tables<"rastreios_ao_vivo">;

type AcompanharRastreioDialogProps = {
  rastreio: RastreioRow | null;
  onClose: () => void;
  onStatusChanged?: () => void;
};

function formatarTempoRelativo(date: Date | null, now: number): string {
  if (!date) return "—";
  const diff = Math.max(0, now - date.getTime());
  if (diff < 1000) return "agora";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s atrás`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min atrás`;
  return date.toLocaleTimeString("pt-BR");
}

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
  const [gpsState, setGpsState] = useState<MotoristaGPSBroadcastState | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

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

  // tick 2s para refrescar "últimos Xs atrás"
  useEffect(() => {
    if (!rastreio) return;
    const t = window.setInterval(() => setNow(Date.now()), 2000);
    return () => window.clearInterval(t);
  }, [rastreio]);

  const papel: "motorista" | "central" | "cliente" = useMemo(() => {
    if (!rastreio || !currentUserId) return "central";
    return rastreio.user_id === currentUserId ? "motorista" : "central";
  }, [rastreio, currentUserId]);

  const open = !!rastreio;

  // Limpa o estado do GPS ao fechar o dialog (evita leak visual entre rastreios)
  useEffect(() => {
    if (!open) {
      setGpsState(null);
      setCurrentUserId(null);
    }
  }, [open]);

  const handleGpsState = useCallback((s: MotoristaGPSBroadcastState) => {
    setGpsState(s);
  }, []);

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

  // --------------------------------------------------
  // Render do painel de diagnóstico do GPS (motorista)
  // --------------------------------------------------
  const renderDiagnostico = () => {
    if (papel !== "motorista") return null;
    if (!gpsState) return null;

    const { ativo, suportado, ultimoEnvioEm, ultimoErro, ultimaPosicao, tentativasPendentes, forcarEnvio } = gpsState;

    const ok = ativo && !ultimoErro && ultimoEnvioEm !== null;
    const warn = ativo && !ultimoEnvioEm && !ultimoErro;
    const err = !!ultimoErro || !suportado;

    const Icon = err ? XCircle : ok ? CheckCircle2 : warn ? Loader2 : AlertTriangle;

    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border text-xs",
          err
            ? "border-destructive/40 bg-destructive/5 text-destructive"
            : ok
              ? "border-[#FF6600]/30 bg-[#FF6600]/5 text-foreground"
              : "border-border bg-muted/40 text-foreground",
        )}
      >
        <Icon className={cn("h-4 w-4", warn && "animate-spin")} aria-hidden />
        <div className="flex-1 min-w-0">
          {!suportado && (
            <span>Este navegador não suporta geolocalização.</span>
          )}
          {suportado && ultimoErro && (
            <span>GPS: {ultimoErro}</span>
          )}
          {suportado && !ultimoErro && !ultimoEnvioEm && (
            <span>A iniciar GPS… (aceite a permissão de localização).</span>
          )}
          {suportado && !ultimoErro && ultimoEnvioEm && (
            <span>
              GPS ativo — último envio{" "}
              <strong className="font-semibold">
                {formatarTempoRelativo(ultimoEnvioEm, now)}
              </strong>
              {ultimaPosicao?.accuracy != null && (
                <span className="text-muted-foreground">
                  {" "}· precisão {Math.round(ultimaPosicao.accuracy)}m
                </span>
              )}
            </span>
          )}
        </div>

        {tentativasPendentes > 0 && (
          <Badge variant="outline" className="text-[10px]">
            <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
            A enviar
          </Badge>
        )}

        {suportado && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => { void forcarEnvio(); }}
            title="Forçar leitura de GPS e envio imediato"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Forçar envio
          </Button>
        )}
      </div>
    );
  };

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
              ? "Mantenha esta janela aberta no celular do motorista. A localização é enviada a cada 7 segundos enquanto a corrida estiver ativa (mesmo parado, há um heartbeat para evitar 'sinal perdido')."
              : "Visualização em tempo real. Apenas o motorista pode atualizar a posição."}
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-3">
          {loadingUser || !rastreio ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              A carregar…
            </div>
          ) : (
            <>
              {renderDiagnostico()}
              <PainelGeolocalizador
                rastreioId={rastreio.id}
                papel={papel}
                intervaloGpsMs={7000}
                fullscreenOnMobile={false}
                heightPx={520}
                onGpsState={handleGpsState}
              />
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
