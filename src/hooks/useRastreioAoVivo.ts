import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";

export type RastreioRow = Tables<"rastreios_ao_vivo">;

export type UseRastreioAoVivoResult = {
  data: RastreioRow | null;
  /**
   * Estado do canal Realtime (WebSocket).
   * - idle: ainda não subscrito (rastreioId vazio)
   * - loading: a ligar
   * - live: canal SUBSCRIBED com sucesso
   * - error: canal CHANNEL_ERROR/TIMED_OUT (polling entra em acção como fallback)
   */
  status: "idle" | "loading" | "live" | "error";
  /** Mensagem de erro do canal Realtime (se houver). */
  error: string | null;
  /** Timestamp local da última mensagem Realtime recebida. */
  lastRealtimeAt: Date | null;
  /** Timestamp local do último snapshot recebido via polling (fallback). */
  lastPollAt: Date | null;
};

/** Intervalo do polling de fallback (ms). O motorista transmite a cada 7s. */
const POLL_INTERVAL_MS = 8000;
/** Delay antes de tentar re-subscrever ao canal Realtime após erro (ms). */
const REALTIME_RETRY_MS = 5000;

/**
 * Carrega a linha completa de `public.rastreios_ao_vivo` e subscreve alterações em
 * tempo real via Supabase Realtime (WebSocket/postgres_changes).
 *
 * Robustez:
 *  1. **Polling paralelo**: mesmo quando o canal Realtime está SUBSCRIBED, um
 *     SELECT é feito a cada 8s. Se o canal falhar silenciosamente (deliveries
 *     perdidos, RLS bloqueando stream, etc.), os dados continuam a chegar.
 *  2. **Auto-reconexão**: em CHANNEL_ERROR / TIMED_OUT, removemos o canal e
 *     re-subscrevemos após `REALTIME_RETRY_MS`.
 *  3. **Auth sincronizada**: ao mount, propagamos o access_token da sessão para
 *     o transporte Realtime (melhora ratio de sucesso quando o token rotaciona).
 */
export function useRastreioAoVivo(rastreioId: string | null | undefined): UseRastreioAoVivoResult {
  const [data, setData] = useState<RastreioRow | null>(null);
  const [status, setStatus] = useState<UseRastreioAoVivoResult["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastRealtimeAt, setLastRealtimeAt] = useState<Date | null>(null);
  const [lastPollAt, setLastPollAt] = useState<Date | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!rastreioId) {
      setStatus("idle");
      setData(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);

    const fetchSnapshot = async (markPoll: boolean) => {
      const { data: row, error: err } = await supabase
        .from("rastreios_ao_vivo")
        .select("*")
        .eq("id", rastreioId)
        .maybeSingle();
      if (cancelled) return;
      if (err) {
        // Não marca status=error se só o polling falhou — o canal pode estar bem.
        console.warn("[useRastreioAoVivo] snapshot error:", err.message);
        return;
      }
      setData(row ?? null);
      if (markPoll) setLastPollAt(new Date());
    };

    // 1) Primeiro snapshot (assim que o componente monta)
    void fetchSnapshot(false);

    // 2) Polling de fallback (roda sempre, independentemente do Realtime)
    pollTimerRef.current = window.setInterval(
      () => { void fetchSnapshot(true); },
      POLL_INTERVAL_MS,
    );

    // 3) Propagar access_token ao transporte Realtime (no-op se não houver sessão).
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }
      } catch {
        /* sem sessão — Realtime tentará conectar mesmo assim para canais públicos */
      }
    })();

    // 4) Canal Realtime com auto-reconexão
    const subscribe = () => {
      if (cancelled) return;
      const channel = supabase
        .channel(`rt-rastreio:${rastreioId}:${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "rastreios_ao_vivo",
            filter: `id=eq.${rastreioId}`,
          },
          (payload) => {
            const newRow = payload.new as RastreioRow | undefined;
            if (newRow) {
              setData(newRow);
              setLastRealtimeAt(new Date());
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "rastreios_ao_vivo",
            filter: `id=eq.${rastreioId}`,
          },
          () => {
            setData(null);
          },
        )
        .subscribe((st) => {
          if (cancelled) return;
          if (st === "SUBSCRIBED") {
            setStatus("live");
            setError(null);
          } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") {
            setStatus("error");
            setError(`Canal Realtime: ${st}`);
            // Auto-retry após delay — o polling continua a funcionar entretanto.
            if (retryTimeoutRef.current) window.clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = window.setTimeout(() => {
              if (cancelled) return;
              if (channelRef.current) {
                void supabase.removeChannel(channelRef.current);
                channelRef.current = null;
              }
              subscribe();
            }, REALTIME_RETRY_MS);
          }
        });
      channelRef.current = channel;
    };
    subscribe();

    return () => {
      cancelled = true;
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [rastreioId]);

  return { data, status, error, lastRealtimeAt, lastPollAt };
}
