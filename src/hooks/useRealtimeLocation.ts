import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type LatLng = { lat: number; lng: number };

export type UseRealtimeLocationOptions = {
  /** Nome da tabela que guarda a posição (ex.: "corridas"). */
  table: string;
  /** Nome da coluna PK usada para filtrar (ex.: "id"). */
  idColumn?: string;
  /** Valor da PK da linha a ouvir (ex.: id da corrida). */
  idValue: string | number;
  /** Coluna de latitude. */
  latColumn?: string;
  /** Coluna de longitude. */
  lngColumn?: string;
  /**
   * Eventos a ouvir. Normalmente `UPDATE` chega sempre que a coluna muda.
   * Passa `*` se o teu fluxo gravar posição por `INSERT` (histórico).
   */
  event?: "UPDATE" | "INSERT" | "*";
  /** Schema do Postgres (por omissão `public`). */
  schema?: string;
  /** Habilita o canal (permite aguardar dados externos). */
  enabled?: boolean;
};

export type UseRealtimeLocationResult = {
  position: LatLng | null;
  lastUpdatedAt: Date | null;
  status: "idle" | "loading" | "live" | "error";
  error: string | null;
};

/**
 * Ouve a posição (lat, lng) de uma linha do Supabase em tempo real e devolve
 * o último ponto recebido. Exige que a tabela esteja na publicação `supabase_realtime`
 * e que as políticas RLS permitam `SELECT` ao utilizador autenticado.
 */
export function useRealtimeLocation(options: UseRealtimeLocationOptions): UseRealtimeLocationResult {
  const {
    table,
    idColumn = "id",
    idValue,
    latColumn = "latitude",
    lngColumn = "longitude",
    event = "UPDATE",
    schema = "public",
    enabled = true,
  } = options;

  const [position, setPosition] = useState<LatLng | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [status, setStatus] = useState<UseRealtimeLocationResult["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || idValue === undefined || idValue === null || idValue === "") {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);

    const applyRow = (row: Record<string, unknown> | null | undefined, stampNow: boolean) => {
      if (!row) return;
      const lat = Number(row[latColumn]);
      const lng = Number(row[lngColumn]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      setPosition({ lat, lng });
      setLastUpdatedAt(stampNow ? new Date() : new Date());
    };

    // 1) Snapshot inicial
    void supabase
      .from(table)
      .select(`${latColumn}, ${lngColumn}`)
      .eq(idColumn, idValue)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
          setStatus("error");
          return;
        }
        if (data) applyRow(data as Record<string, unknown>, false);
      });

    // 2) Canal realtime
    const channelName = `rt-location:${schema}:${table}:${idColumn}=${idValue}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event,
          schema,
          table,
          filter: `${idColumn}=eq.${idValue}`,
        },
        (payload) => {
          const newRow = (payload.new || payload.record) as Record<string, unknown> | undefined;
          applyRow(newRow, true);
        },
      )
      .subscribe((st) => {
        if (cancelled) return;
        if (st === "SUBSCRIBED") {
          setStatus("live");
        } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") {
          setStatus((prev) => (prev === "live" ? "error" : prev));
          if (st === "CHANNEL_ERROR") setError("Canal Realtime falhou.");
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
  }, [table, idColumn, idValue, latColumn, lngColumn, event, schema, enabled]);

  return { position, lastUpdatedAt, status, error };
}
