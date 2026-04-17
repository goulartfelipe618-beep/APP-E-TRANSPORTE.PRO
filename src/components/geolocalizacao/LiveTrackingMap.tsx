import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { AlertTriangle, Loader2, Radio, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRastreioAoVivo } from "@/hooks/useRastreioAoVivo";
import ResumoViagemCard from "./ResumoViagemCard";

// ------------------------------------------------------------
// CartoDB tiles (sem API key)
// ------------------------------------------------------------
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const CARTO_LIGHT_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const CARTO_DARK_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const CARTO_SUBDOMAINS = "abcd";

// Considera-se "sinal perdido" após este tempo sem updates Realtime (ms).
const SINAL_PERDIDO_MS = 30_000;

function isDocumentDark(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

// ------------------------------------------------------------
// Ícone do veículo — três estados: ativo (laranja pulsante),
// alerta (vermelho pulsante), inativo (cinza sem pulse).
// ------------------------------------------------------------
function makeVehicleIcon(variant: "ativo" | "perdido" | "inativo"): L.DivIcon {
  const color = variant === "perdido" ? "#EF4444" : variant === "inativo" ? "#9CA3AF" : "#FF6600";
  const pulse = variant === "inativo" ? "" : `
    <span style="
      position:absolute;inset:-6px;border-radius:9999px;
      background:${color}33;animation:etp-pulse 1.8s ease-out infinite;
    "></span>`;
  return L.divIcon({
    className: "etp-vehicle-marker",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `
      <span style="position:relative;display:block;width:22px;height:22px;">
        ${pulse}
        <span style="
          position:absolute;inset:0;border-radius:9999px;background:${color};
          border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);
        "></span>
      </span>
      <style>
        @keyframes etp-pulse {
          0%   { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      </style>
    `,
  });
}

// ------------------------------------------------------------
// Helper interno — tem acesso ao useMap()
// ------------------------------------------------------------
function MapController({
  position,
  isDark,
}: {
  position: { lat: number; lng: number } | null;
  isDark: boolean;
}) {
  const map = useMap();
  const didInvalidateRef = useRef(false);

  useEffect(() => {
    if (didInvalidateRef.current) return;
    const t = setTimeout(() => {
      map.invalidateSize();
      didInvalidateRef.current = true;
    }, 50);
    return () => clearTimeout(t);
  }, [map]);

  useEffect(() => {
    if (!position) return;
    const next = L.latLng(position.lat, position.lng);
    if (!map.getBounds().contains(next)) {
      map.panTo(next, { animate: true, duration: 0.6 });
    }
  }, [map, position]);

  useEffect(() => {
    // Evita "saltos" ao trocar tiles: redesenha após troca de tema
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(t);
  }, [map, isDark]);

  return null;
}

export type LiveTrackingMapProps = {
  /** ID do rastreio (linha em `public.rastreios_ao_vivo`). */
  rastreioId: string;
  /** Posição inicial opcional (se ainda não houver snapshot). */
  fallbackCenter?: { lat: number; lng: number };
  /** Nível de zoom inicial. */
  zoom?: number;
  /** Classe do container externo. */
  className?: string;
  /** Altura do mapa em px (apenas em desktop). No mobile ocupa o viewport todo se `fullscreenOnMobile` estiver ligado. */
  heightPx?: number;
  /** Tooltip do marcador. */
  title?: string;
  /** No mobile, o mapa ocupa a viewport inteira (fixed inset-0). */
  fullscreenOnMobile?: boolean;
  /** Renderização opcional por cima do mapa (ex.: botão flutuante de Encerrar Viagem). */
  overlay?: React.ReactNode;
};

const DEFAULT_CENTER = { lat: -23.55052, lng: -46.633308 };

/**
 * Rastreio em tempo real. Auto-troca para o `ResumoViagemCard` quando a corrida
 * está concluída. Marca "Sinal Perdido" se passarem > 30s sem atualização.
 */
export default function LiveTrackingMap({
  rastreioId,
  fallbackCenter,
  zoom = 15,
  className,
  heightPx = 520,
  title = "Veículo",
  fullscreenOnMobile = false,
  overlay,
}: LiveTrackingMapProps) {
  const { data: rastreio, status: subStatus, lastRealtimeAt } = useRastreioAoVivo(rastreioId);
  const [isDark, setIsDark] = useState<boolean>(() => isDocumentDark());
  const [now, setNow] = useState<number>(() => Date.now());

  // Tick de 5s para reavaliar "sinal perdido".
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

  // Observa troca de tema (class="dark" no <html>)
  useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
    const html = document.documentElement;
    const observer = new MutationObserver(() => setIsDark(html.classList.contains("dark")));
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const position = useMemo<{ lat: number; lng: number } | null>(() => {
    if (!rastreio?.latitude || !rastreio?.longitude) return null;
    const lat = Number(rastreio.latitude);
    const lng = Number(rastreio.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [rastreio?.latitude, rastreio?.longitude]);

  const initialCenter = useMemo(
    () => fallbackCenter ?? position ?? DEFAULT_CENTER,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ----------------------------------------------
  // Auto-swap: se a corrida está concluída → card
  // ----------------------------------------------
  if (rastreio?.status === "concluida") {
    return <ResumoViagemCard rastreio={rastreio} className={className} />;
  }

  // ----------------------------------------------
  // Estado do sinal (para cor do marker + HUD)
  // ----------------------------------------------
  const ultimaBatida =
    lastRealtimeAt?.getTime() ??
    (rastreio?.ultima_atualizacao ? new Date(rastreio.ultima_atualizacao).getTime() : null);
  const tempoSemUpdate = ultimaBatida ? now - ultimaBatida : null;
  const sinalPerdido =
    !!position && tempoSemUpdate !== null && tempoSemUpdate > SINAL_PERDIDO_MS;

  const tileUrl = isDark ? CARTO_DARK_URL : CARTO_LIGHT_URL;
  const tileKey = isDark ? "dark" : "light";

  const markerPosition: L.LatLngExpression = position
    ? [position.lat, position.lng]
    : [initialCenter.lat, initialCenter.lng];

  const markerVariant: "ativo" | "perdido" | "inativo" = !position
    ? "inativo"
    : sinalPerdido
      ? "perdido"
      : "ativo";
  const markerIcon = useMemo(() => makeVehicleIcon(markerVariant), [markerVariant]);

  const hud = (() => {
    if (subStatus === "error")
      return { label: "Sem ligação Realtime", tone: "error" as const, Icon: WifiOff };
    if (subStatus !== "live")
      return { label: "A ligar ao Realtime...", tone: "loading" as const, Icon: Loader2 };
    if (sinalPerdido)
      return { label: "Sinal Perdido", tone: "error" as const, Icon: AlertTriangle };
    if (position) return { label: "Ao vivo", tone: "live" as const, Icon: Radio };
    return { label: "À espera de posição...", tone: "idle" as const, Icon: Radio };
  })();
  const HudIcon = hud.Icon;

  return (
    <div
      className={cn(
        "relative overflow-hidden border-border bg-card shadow-sm",
        fullscreenOnMobile
          ? "fixed inset-0 z-40 rounded-none border-0 md:static md:z-auto md:rounded-xl md:border"
          : "rounded-xl border",
        className,
      )}
    >
      <div
        style={{ height: fullscreenOnMobile ? undefined : `${heightPx}px` }}
        className={cn(
          "w-full",
          fullscreenOnMobile && "h-[100dvh] md:h-[var(--etp-map-h)]",
        )}
      >
        <MapContainer
          center={[initialCenter.lat, initialCenter.lng]}
          zoom={zoom}
          scrollWheelZoom
          worldCopyJump
          preferCanvas
          style={{ width: "100%", height: "100%" }}
          aria-label="Mapa de rastreio ao vivo"
        >
          <TileLayer
            key={tileKey}
            url={tileUrl}
            attribution={CARTO_ATTRIBUTION}
            subdomains={CARTO_SUBDOMAINS}
            maxZoom={20}
            detectRetina
            crossOrigin
          />

          <Marker
            position={markerPosition}
            icon={markerIcon}
            title={title}
            riseOnHover
          />

          <MapController position={position} isDark={isDark} />
        </MapContainer>
      </div>

      {/* HUD de estado */}
      <div
        className={cn(
          "pointer-events-none absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur",
          hud.tone === "error"
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-border bg-background/90",
        )}
        role="status"
        aria-live="polite"
      >
        <HudIcon
          className={cn(
            "h-3.5 w-3.5",
            hud.tone === "live" && "text-[#FF6600]",
            hud.tone === "loading" && "animate-spin text-muted-foreground",
            hud.tone === "error" && "text-destructive",
            hud.tone === "idle" && "text-muted-foreground",
          )}
          aria-hidden
        />
        <span className="tracking-wide">
          {hud.label}
          {sinalPerdido && tempoSemUpdate !== null && (
            <span className="ml-1 opacity-80">
              · {Math.round(tempoSemUpdate / 1000)}s sem atualização
            </span>
          )}
        </span>
        {lastRealtimeAt && hud.tone === "live" && (
          <span className="ml-1 text-muted-foreground">
            · {lastRealtimeAt.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Overlay (ex.: botão flutuante no mobile) */}
      {overlay && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] flex justify-center">
          <div className="pointer-events-auto mb-4 w-full max-w-md px-4">{overlay}</div>
        </div>
      )}
    </div>
  );
}
