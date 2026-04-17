import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  /** Se o hook está a fazer watch/heartbeat. */
  ativo: boolean;
  /** Se o browser suporta Geolocation API. */
  suportado: boolean;
  /** Data/hora do último envio bem-sucedido. */
  ultimoEnvioEm: Date | null;
  /** Última posição enviada com sucesso (para UI de diagnóstico). */
  ultimaPosicao: { lat: number; lng: number; accuracy: number | null } | null;
  /** Última mensagem de erro (geolocation ou supabase). */
  ultimoErro: string | null;
  /** Nº de envios em curso. */
  tentativasPendentes: number;
  /** Força um novo getCurrentPosition + envio imediato (ignora throttle). */
  forcarEnvio: () => Promise<void>;
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
 * Usa DUAS fontes:
 *  1. `navigator.geolocation.watchPosition` — dispara quando há movimento real
 *     (eficiente em bateria).
 *  2. Heartbeat com `getCurrentPosition` a cada `intervalo` — garante um ping
 *     mesmo quando o veículo está parado (cliente não vê "sinal perdido" falso).
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

  const suportado =
    typeof navigator !== "undefined" &&
    typeof navigator.geolocation !== "undefined" &&
    "geolocation" in navigator;

  const [ativo, setAtivo] = useState(false);
  const [ultimoEnvioEm, setUltimoEnvioEm] = useState<Date | null>(null);
  const [ultimaPosicao, setUltimaPosicao] = useState<
    { lat: number; lng: number; accuracy: number | null } | null
  >(null);
  const [ultimoErro, setUltimoErro] = useState<string | null>(null);
  const [tentativasPendentes, setTentativasPendentes] = useState(0);

  const ultimoEnvioRef = useRef<number>(0);
  const enviandoRef = useRef<boolean>(false);
  const rastreioIdRef = useRef<string | null | undefined>(rastreioId);
  const enabledRef = useRef<boolean>(enabled);

  useEffect(() => { rastreioIdRef.current = rastreioId; }, [rastreioId]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  // --------------------------------------------------
  // Envia uma posição para o Supabase (respeita throttle)
  // --------------------------------------------------
  const enviarPosicao = useCallback(
    async (pos: GeolocationPosition, ignorarThrottle = false) => {
      const rid = rastreioIdRef.current;
      if (!rid) return;
      const agora = Date.now();
      if (!ignorarThrottle && agora - ultimoEnvioRef.current < intervalo) return;
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
          .eq("id", rid);

        if (updErr) throw updErr;

        if (gravarBreadcrumbs) {
          const { error: insErr } = await supabase
            .from("rastreios_ao_vivo_pontos")
            .insert({
              rastreio_id: rid,
              latitude,
              longitude,
              heading,
              speed_kmh,
              accuracy_m: accuracy,
            });
          if (insErr) throw insErr;
        }

        ultimoEnvioRef.current = agora;
        setUltimoEnvioEm(new Date());
        setUltimaPosicao({ lat: latitude, lng: longitude, accuracy });
        setUltimoErro(null);
        onEnviado?.({
          lat: latitude,
          lng: longitude,
          accuracy: accuracy ?? undefined,
          speed: speed_kmh ?? undefined,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao enviar posição.";
        setUltimoErro(msg);
        onErro?.(msg);
      } finally {
        enviandoRef.current = false;
        setTentativasPendentes((n) => Math.max(0, n - 1));
      }
    },
    [intervalo, gravarBreadcrumbs, onEnviado, onErro],
  );

  // --------------------------------------------------
  // Handler de erro da Geolocation API
  // --------------------------------------------------
  const tratarErroGeolocation = useCallback(
    (err: GeolocationPositionError) => {
      const msg =
        err.code === err.PERMISSION_DENIED
          ? "Permissão de localização negada no browser."
          : err.code === err.POSITION_UNAVAILABLE
            ? "Localização indisponível neste dispositivo (sem GPS/Wi-Fi conhecido?)."
            : err.code === err.TIMEOUT
              ? "Tempo esgotado ao obter localização."
              : err.message;
      setUltimoErro(msg);
      onErro?.(msg);
    },
    [onErro],
  );

  // --------------------------------------------------
  // Expor função forcarEnvio() à UI
  // --------------------------------------------------
  const forcarEnvio = useCallback(async () => {
    if (!suportado) {
      const msg = "Este navegador não suporta geolocalização.";
      setUltimoErro(msg);
      onErro?.(msg);
      return;
    }
    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void enviarPosicao(pos, /* ignorarThrottle */ true).finally(() => resolve());
        },
        (err) => {
          tratarErroGeolocation(err);
          resolve();
        },
        {
          enableHighAccuracy,
          maximumAge: 0,
          timeout: 15_000,
        },
      );
    });
  }, [suportado, enableHighAccuracy, enviarPosicao, tratarErroGeolocation, onErro]);

  // --------------------------------------------------
  // Efeito principal: watchPosition + heartbeat interval
  // --------------------------------------------------
  useEffect(() => {
    if (!enabled || !rastreioId || !suportado) {
      setAtivo(false);
      return;
    }

    let watchId: number | null = null;
    let heartbeatTimer: number | null = null;

    // 1) watchPosition — eficiente, só dispara quando há movimento significativo
    watchId = navigator.geolocation.watchPosition(
      (pos) => { void enviarPosicao(pos); },
      tratarErroGeolocation,
      {
        enableHighAccuracy,
        maximumAge: Math.floor(intervalo / 2),
        timeout: 15_000,
      },
    );

    // 2) Heartbeat — força um ping a cada `intervalo` mesmo parado
    heartbeatTimer = window.setInterval(() => {
      if (!enabledRef.current) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => { void enviarPosicao(pos); },
        tratarErroGeolocation,
        {
          enableHighAccuracy,
          maximumAge: intervalo, // aceita cache recente para poupar bateria
          timeout: 15_000,
        },
      );
    }, intervalo);

    setAtivo(true);

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
      setAtivo(false);
    };
  }, [rastreioId, intervalo, enabled, suportado, enableHighAccuracy, enviarPosicao, tratarErroGeolocation]);

  // Memoizar o objeto de retorno evita re-render-loops em componentes que
  // passam este estado via prop/callback (ex.: PainelGeolocalizador.onGpsState).
  return useMemo<MotoristaGPSBroadcastState>(
    () => ({
      ativo,
      suportado,
      ultimoEnvioEm,
      ultimaPosicao,
      ultimoErro,
      tentativasPendentes,
      forcarEnvio,
    }),
    [ativo, suportado, ultimoEnvioEm, ultimaPosicao, ultimoErro, tentativasPendentes, forcarEnvio],
  );
}
