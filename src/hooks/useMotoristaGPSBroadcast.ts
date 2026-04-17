import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MotoristaGPSBroadcastOptions = {
  /** ID do rastreio em `public.rastreios_ao_vivo` (user_id precisa ser o motorista autenticado). */
  rastreioId: string | null | undefined;
  /** Intervalo mínimo entre envios (ms). 5000–10000. Default: 7000 (7s). */
  intervaloMs?: number;
  /** Se true, também insere um ponto em `rastreios_ao_vivo_pontos` (breadcrumbs). Default: true. */
  gravarBreadcrumbs?: boolean;
  /** Liga/desliga o broadcast (ex.: pausar enquanto o motorista não aceitou a corrida). */
  enabled?: boolean;
  /** Altíssima precisão (default true). Maior consumo — ainda assim respeita o intervalo mínimo. */
  enableHighAccuracy?: boolean;
  /** Callback opcional a cada envio com sucesso. */
  onEnviado?: (ponto: { lat: number; lng: number; accuracy?: number; speed?: number }) => void;
  /** Callback opcional em caso de erro (geolocation ou supabase). */
  onErro?: (mensagem: string) => void;
};

export type MotoristaGPSBroadcastState = {
  ativo: boolean;
  suportado: boolean;
  ultimoEnvioEm: Date | null;
  ultimoErro: string | null;
  tentativasPendentes: number;
};

const MIN_INTERVAL = 5000;
const MAX_INTERVAL = 10000;
const DEFAULT_INTERVAL = 7000;

/**
 * Hook para o lado do motorista: lê o GPS do dispositivo e atualiza
 * `public.rastreios_ao_vivo` respeitando um intervalo mínimo de 5–10s
 * (economia de bateria) e opcionalmente grava breadcrumbs em
 * `public.rastreios_ao_vivo_pontos`.
 *
 * Requer que o utilizador autenticado seja o dono do rastreio (RLS).
 */
export function useMotoristaGPSBroadcast(
  options: MotoristaGPSBroadcastOptions,
): MotoristaGPSBroadcastState {
  const {
    rastreioId,
    intervaloMs,
    gravarBreadcrumbs = true,
    enabled = true,
    enableHighAccuracy = true,
    onEnviado,
    onErro,
  } = options;

  const intervalo = Math.max(
    MIN_INTERVAL,
    Math.min(MAX_INTERVAL, intervaloMs ?? DEFAULT_INTERVAL),
  );

  const suportado = typeof navigator !== "undefined" && "geolocation" in navigator;

  const [ativo, setAtivo] = useState(false);
  const [ultimoEnvioEm, setUltimoEnvioEm] = useState<Date | null>(null);
  const [ultimoErro, setUltimoErro] = useState<string | null>(null);
  const [tentativasPendentes, setTentativasPendentes] = useState(0);

  const ultimoEnvioRef = useRef<number>(0);
  const enviandoRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled || !rastreioId || !suportado) {
      setAtivo(false);
      return;
    }

    let watchId: number | null = null;
    let cancelled = false;

    const enviar = async (pos: GeolocationPosition) => {
      const agora = Date.now();
      if (agora - ultimoEnvioRef.current < intervalo) return; // throttle
      if (enviandoRef.current) return;

      enviandoRef.current = true;
      setTentativasPendentes((n) => n + 1);
      try {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        const heading = pos.coords.heading ?? null;
        const speedMs = pos.coords.speed ?? null;
        const accuracy = pos.coords.accuracy ?? null;
        const speed_kmh = speedMs !== null && Number.isFinite(speedMs) ? speedMs * 3.6 : null;

        const { error: updErr } = await supabase
          .from("rastreios_ao_vivo")
          .update({
            latitude,
            longitude,
            heading,
            speed_kmh,
            accuracy_m: accuracy,
          })
          .eq("id", rastreioId);

        if (updErr) throw updErr;

        if (gravarBreadcrumbs) {
          const { error: insErr } = await supabase
            .from("rastreios_ao_vivo_pontos")
            .insert({
              rastreio_id: rastreioId,
              latitude,
              longitude,
              heading,
              speed_kmh,
              accuracy_m: accuracy,
            });
          if (insErr) throw insErr;
        }

        ultimoEnvioRef.current = agora;
        if (!cancelled) {
          setUltimoEnvioEm(new Date());
          setUltimoErro(null);
          onEnviado?.({
            lat: latitude,
            lng: longitude,
            accuracy: accuracy ?? undefined,
            speed: speed_kmh ?? undefined,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao enviar posição.";
        if (!cancelled) {
          setUltimoErro(msg);
          onErro?.(msg);
        }
      } finally {
        enviandoRef.current = false;
        if (!cancelled) setTentativasPendentes((n) => Math.max(0, n - 1));
      }
    };

    const onError = (err: GeolocationPositionError) => {
      const msg =
        err.code === err.PERMISSION_DENIED
          ? "Permissão de localização negada."
          : err.code === err.POSITION_UNAVAILABLE
            ? "Localização indisponível."
            : err.code === err.TIMEOUT
              ? "Tempo esgotado ao obter localização."
              : err.message;
      if (!cancelled) {
        setUltimoErro(msg);
        onErro?.(msg);
      }
    };

    // watchPosition é mais eficiente que setInterval(getCurrentPosition):
    // o browser só dispara callbacks quando há movimento significativo.
    // O throttling (intervalo) fica no handler enviar(), poupando rede/bateria.
    watchId = navigator.geolocation.watchPosition(enviar, onError, {
      enableHighAccuracy,
      maximumAge: Math.floor(intervalo / 2),
      timeout: 15_000,
    });
    setAtivo(true);

    return () => {
      cancelled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      setAtivo(false);
    };
  }, [rastreioId, intervalo, enabled, suportado, gravarBreadcrumbs, enableHighAccuracy, onEnviado, onErro]);

  return { ativo, suportado, ultimoEnvioEm, ultimoErro, tentativasPendentes };
}
