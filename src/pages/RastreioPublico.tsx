import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  AlertTriangle, Car, Loader2, MapPin, Radio, WifiOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// --------------------------------------------------------------------
// Tipagem do retorno da RPC get_rastreio_publico (row alias)
// --------------------------------------------------------------------
type RastreioPublico = {
  id: string;
  status: string;
  motorista_nome: string | null;
  veiculo_descricao: string | null;
  cliente_nome: string | null;
  categoria_rastreamento: string | null;
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  speed_kmh: number | null;
  ultima_atualizacao: string | null;
  iniciado_em: string | null;
  finalizado_em: string | null;
  expira_em: string | null;
  origem_endereco: string | null;
  destino_endereco: string | null;
  distancia_total_km: number | null;
  duracao_segundos: number | null;
  data_hora_fim: string | null;
};

// --------------------------------------------------------------------
// Tiles (CartoDB — aceite na CSP do projeto via *.basemaps.cartocdn.com)
// --------------------------------------------------------------------
const CARTO_LIGHT_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const CARTO_DARK_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const CARTO_SUBDOMAINS = ["a", "b", "c", "d"];
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const DEFAULT_CENTER = { lat: -23.55052, lng: -46.633308 };
const POLL_MS = 5000;
const SINAL_PERDIDO_MS = 30_000;

function isDocumentDark() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

function makeVehicleIcon(variant: "ativo" | "perdido" | "inativo"): L.DivIcon {
  const color =
    variant === "ativo" ? "#FF6600" :
    variant === "perdido" ? "#EF4444" :
    "#6B7280";
  const html = `
    <div style="
      width: 38px; height: 38px; border-radius: 50%;
      background: ${color}; border: 3px solid white;
      box-shadow: 0 4px 10px rgba(0,0,0,0.35);
      display:flex; align-items:center; justify-content:center;
      color: white; font-weight: 700;
    ">🚘</div>`;
  return L.divIcon({
    className: "etp-vehicle-marker",
    html,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

function MapController({
  position,
}: {
  position: { lat: number; lng: number } | null;
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

  return null;
}

function Resumo({ data }: { data: RastreioPublico }) {
  const distancia = data.distancia_total_km != null ? Number(data.distancia_total_km) : null;
  const dur = data.duracao_segundos;
  const fim = data.data_hora_fim || data.finalizado_em;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Car className="h-5 w-5 text-[#FF6600]" />
          <h1 className="text-xl font-bold">Viagem concluída</h1>
        </div>
        {data.cliente_nome && (
          <p className="text-sm text-muted-foreground">
            Olá <strong className="text-foreground">{data.cliente_nome}</strong>, obrigado por viajar connosco!
          </p>
        )}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <p className="text-xs text-muted-foreground">Distância</p>
            <p className="text-lg font-semibold">
              {distancia != null ? `${distancia.toFixed(2)} km` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Duração</p>
            <p className="text-lg font-semibold">
              {dur != null ? `${Math.max(0, Math.round(dur / 60))} min` : "—"}
            </p>
          </div>
          {data.origem_endereco && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Origem</p>
              <p className="text-sm">{data.origem_endereco}</p>
            </div>
          )}
          {data.destino_endereco && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Destino</p>
              <p className="text-sm">{data.destino_endereco}</p>
            </div>
          )}
          {fim && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Encerrada em</p>
              <p className="text-sm">{new Date(fim).toLocaleString("pt-BR")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RastreioPublico() {
  const { token } = useParams<{ token: string }>();
  const [rastreio, setRastreio] = useState<RastreioPublico | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState<boolean>(() => isDocumentDark());
  const [lastPollOk, setLastPollOk] = useState<Date | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  // Observa troca de tema (class="dark" no <html>)
  useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
    const html = document.documentElement;
    const observer = new MutationObserver(() => setIsDark(html.classList.contains("dark")));
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // tick a cada 5s para reavaliar "sinal perdido"
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

  const fetchSnapshot = useCallback(async () => {
    if (!token) return;
    try {
      const { data, error: rpcErr } = await supabase
        .rpc("get_rastreio_publico", { p_token: token });
      if (rpcErr) throw rpcErr;
      const row = Array.isArray(data) && data.length > 0 ? (data[0] as RastreioPublico) : null;
      if (!row) {
        setError("Link inválido ou expirado.");
        setRastreio(null);
      } else {
        setError(null);
        setRastreio(row);
        setLastPollOk(new Date());
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao consultar o rastreio.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Primeiro fetch + polling
  useEffect(() => {
    if (!token) return;
    void fetchSnapshot();
    const interval = window.setInterval(() => { void fetchSnapshot(); }, POLL_MS);
    return () => window.clearInterval(interval);
  }, [token, fetchSnapshot]);

  const position = useMemo<{ lat: number; lng: number } | null>(() => {
    if (!rastreio?.latitude || !rastreio?.longitude) return null;
    const lat = Number(rastreio.latitude);
    const lng = Number(rastreio.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [rastreio?.latitude, rastreio?.longitude]);

  const initialCenter = useMemo(
    () => position ?? DEFAULT_CENTER,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Loading / erro / concluída
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-sm text-muted-foreground">
        Link de rastreio inválido.
      </div>
    );
  }

  if (loading && !rastreio) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        A localizar o veículo…
      </div>
    );
  }

  if (error && !rastreio) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Link indisponível</h1>
          <p className="text-sm text-muted-foreground">
            {error}
          </p>
          <p className="text-xs text-muted-foreground">
            Entre em contato com quem lhe enviou o link.
          </p>
        </div>
      </div>
    );
  }

  if (rastreio && (rastreio.status === "concluida" || rastreio.status === "finalizado")) {
    return <Resumo data={rastreio} />;
  }

  const ultimaBatida = rastreio?.ultima_atualizacao
    ? new Date(rastreio.ultima_atualizacao).getTime()
    : null;
  const tempoSemUpdate = ultimaBatida ? now - ultimaBatida : null;
  const sinalPerdido =
    !!position && tempoSemUpdate !== null && tempoSemUpdate > SINAL_PERDIDO_MS;

  const tileUrl = isDark ? CARTO_DARK_URL : CARTO_LIGHT_URL;
  const tileKey = isDark ? "dark" : "light";

  const markerVariant: "ativo" | "perdido" | "inativo" = !position
    ? "inativo"
    : sinalPerdido
      ? "perdido"
      : "ativo";
  const markerIcon = makeVehicleIcon(markerVariant);

  const hud = (() => {
    if (error) return { label: "A reconectar…", tone: "error" as const, Icon: WifiOff };
    if (!position) return { label: "À espera de posição…", tone: "idle" as const, Icon: Radio };
    if (sinalPerdido) return { label: "Sinal perdido", tone: "error" as const, Icon: AlertTriangle };
    return { label: "Ao vivo", tone: "live" as const, Icon: Radio };
  })();
  const HudIcon = hud.Icon;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header mínimo do cliente */}
      <div className="px-4 py-3 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="h-4 w-4 text-[#FF6600] shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">
              {rastreio?.cliente_nome ? `Olá, ${rastreio.cliente_nome}` : "Acompanhe seu transfer"}
            </div>
            {rastreio?.motorista_nome && (
              <div className="text-[11px] text-muted-foreground truncate">
                Motorista: {rastreio.motorista_nome}
                {rastreio?.veiculo_descricao ? ` · ${rastreio.veiculo_descricao}` : ""}
              </div>
            )}
          </div>
        </div>
        {lastPollOk && (
          <div className="text-[11px] text-muted-foreground">
            Sync: {lastPollOk.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Mapa */}
      <div className="relative flex-1">
        <MapContainer
          center={[initialCenter.lat, initialCenter.lng]}
          zoom={15}
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
            position={
              position ? [position.lat, position.lng] : [initialCenter.lat, initialCenter.lng]
            }
            icon={markerIcon}
            title={rastreio?.veiculo_descricao ?? "Veículo"}
            riseOnHover
          />
          <MapController position={position} />
        </MapContainer>

        {/* HUD */}
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
              hud.tone === "error" && "text-destructive",
              hud.tone === "idle" && "text-muted-foreground",
            )}
            aria-hidden
          />
          <span className="tracking-wide">
            {hud.label}
            {sinalPerdido && tempoSemUpdate !== null && (
              <span className="ml-1 opacity-80">
                · {Math.round(tempoSemUpdate / 1000)}s
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
