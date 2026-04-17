import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";

export type RastreioRow = Tables<"rastreios_ao_vivo">;

export type UseRastreioAoVivoResult = {
  data: RastreioRow | null;
  status: "idle" | "loading" | "live" | "error";
  error: string | null;
  /** Timestamp local da última mensagem Realtime recebida (null se só houve snapshot). */
  lastRealtimeAt: Date | null;
};

/**
 * Carrega a linha completa de `public.rastreios_ao_vivo` e subscreve alterações em
 * tempo real. Usado pelo `LiveTrackingMap` para detetar `status = 'concluida'` e
 * trocar automaticamente para o `ResumoViagemCard`.
 */
export function useRastreioAoVivo(rastreioId: string | null | undefined): UseRastreioAoVivoResult {
  const [data, setData] = useState<RastreioRow | null>(null);
  const [status, setStatus] = useState<UseRastreioAoVivoResult["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastRealtimeAt, setLastRealtimeAt] = useState<Date | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!rastreioId) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);

    // Snapshot inicial
    void supabase
      .from("rastreios_ao_vivo")
      .select("*")
      .eq("id", rastreioId)
      .maybeSingle()
      .then(({ data: row, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
          setStatus("error");
          return;
        }
        setData(row ?? null);
      });

    const channel = supabase
      .channel(`rt-rastreio:${rastreioId}`)
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
        } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") {
          setStatus("error");
          setError(`Canal Realtime: ${st}`);
        }
      });

    channelRef.current = channel;

    return () => {
      cancelled = true;
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [rastreioId]);

  return { data, status, error, lastRealtimeAt };
}
