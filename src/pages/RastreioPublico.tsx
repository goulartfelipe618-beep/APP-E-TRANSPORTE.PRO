import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  AlertTriangle, Car, CheckCircle2, Loader2, MapPin, Play, Radio,
  ShieldAlert, WifiOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  apagarDeviceSecret,
  gerarDeviceSecret,
  guardarDeviceSecret,
  lerDeviceSecret,
} from "@/lib/rastreioDeviceSecret";

// --------------------------------------------------------------------
// Tipagem do retorno de get_rastreio_publico (linha do RPC)
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
  iniciado_em_dispositivo: string | null;
  finalizado_em: string | null;
  expira_em: string | null;
  origem_endereco: string | null;
  destino_endereco: string | null;
  distancia_total_km: number | null;
  duracao_segundos: number | null;
  data_hora_fim: string | null;
};

// --------------------------------------------------------------------
// Tiles (CartoDB — aceite na CSP via *.basemaps.cartocdn.com)
// --------------------------------------------------------------------
const CARTO_LIGHT_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const CARTO_DARK_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const CARTO_SUBDOMAINS = ["a", "b", "c", "d"];
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const DEFAULT_CENTER = { lat: -23.55052, lng: -46.633308 };
/** Polling a cada 5s para descobrir quando o dono encerra a viagem (status). */
const POLL_MS = 5000;
/** Intervalo de envio de GPS (heartbeat mesmo parado). */
const GPS_INTERVAL_MS = 7000;
/** Tempo sem posição local antes de marcar "sinal perdido" na HUD. */
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

// --------------------------------------------------------------------
// Resumo da viagem (mostrado quando status = concluida/finalizado)
// --------------------------------------------------------------------
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

// --------------------------------------------------------------------
// Tela "Iniciar viagem" — mostrada antes de o cliente autorizar o GPS
// --------------------------------------------------------------------
function PreStartScreen({
  clienteNome,
  motoristaNome,
  veiculo,
  onIniciar,
  iniciando,
  erroIniciar,
}: {
  clienteNome: string | null;
  motoristaNome: string | null;
  veiculo: string | null;
  onIniciar: () => void;
  iniciando: boolean;
  erroIniciar: string | null;
}) {
  return (
    <div className="min-h-[100dvh] w-full bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-[#FF6600]/10 flex items-center justify-center">
            <MapPin className="h-5 w-5 text-[#FF6600]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {clienteNome ? `Olá, ${clienteNome}` : "Bem-vindo"}
            </h1>
            <p className="text-xs text-muted-foreground">E-Transporte.pro · Rastreio ao vivo</p>
          </div>
        </div>

        {(motoristaNome || veiculo) && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm space-y-1">
            {motoristaNome && (
              <div>
                <span className="text-muted-foreground">Motorista: </span>
                <span className="font-medium text-foreground">{motoristaNome}</span>
              </div>
            )}
            {veiculo && (
              <div>
                <span className="text-muted-foreground">Veículo: </span>
                <span className="font-medium text-foreground">{veiculo}</span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Para iniciar a viagem, clique no botão abaixo e{" "}
            <strong className="text-foreground">autorize o acesso à sua localização</strong>{" "}
            quando o navegador perguntar.
          </p>
          <p className="text-xs">
            A sua posição só será transmitida durante a viagem. Ao concluir,
            o rastreio será encerrado automaticamente.
          </p>
        </div>

        <button
          type="button"
          onClick={onIniciar}
          disabled={iniciando}
          className={cn(
            "w-full h-12 rounded-xl font-semibold text-white",
            "bg-[#FF6600] hover:bg-[#FF6600]/90 disabled:bg-[#FF6600]/60",
            "shadow-md transition-colors flex items-center justify-center gap-2",
          )}
        >
          {iniciando ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              A iniciar…
            </>
          ) : (
            <>
              <Play className="h-5 w-5" />
              Iniciar viagem
            </>
          )}
        </button>

        {erroIniciar && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{erroIniciar}</span>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center">
          Problemas? Entre em contato com quem lhe enviou este link.
        </p>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// Tela "Link já utilizado" — quando outro device já iniciou a viagem
// --------------------------------------------------------------------
function LockedScreen({ motivo }: { motivo: string }) {
  return (
    <div className="min-h-[100dvh] w-full bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-4">
        <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-xl font-bold text-foreground">Link indisponível</h1>
        <p className="text-sm text-muted-foreground">{motivo}</p>
        <p className="text-xs text-muted-foreground">
          Se foi você quem iniciou, volte ao dispositivo onde clicou em
          "Iniciar viagem" pela primeira vez.
        </p>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// Componente principal
// --------------------------------------------------------------------
type Modo =
  | "loading"            // a consultar get_rastreio_publico pela primeira vez
  | "pre-start"          // ainda não iniciado — mostra botão
  | "locked-outro-device"// iniciado por outro browser
  | "iniciando"          // clicou iniciar, a aguardar geolocation + RPC
  | "tracking"           // em andamento a transmitir posição
  | "concluida"          // corrida encerrada pelo dono
  | "erro-fatal";        // link inválido / expirado

export default function RastreioPublico() {
  const { token } = useParams<{ token: string }>();

  const [modo, setModo] = useState<Modo>("loading");
  const [rastreio, setRastreio] = useState<RastreioPublico | null>(null);
  const [erroFatal, setErroFatal] = useState<string | null>(null);
  const [erroIniciar, setErroIniciar] = useState<string | null>(null);
  const [erroGps, setErroGps] = useState<string | null>(null);

  const [isDark, setIsDark] = useState<boolean>(() => isDocumentDark());
  const [lastGpsSentAt, setLastGpsSentAt] = useState<Date | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  // Refs para workers em background sem re-renders
  const deviceSecretRef = useRef<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const sendInFlightRef = useRef<boolean>(false);
  const lastSendTsRef = useRef<number>(0);

  // Observa troca de tema
  useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
    const html = document.documentElement;
    const observer = new MutationObserver(() => setIsDark(html.classList.contains("dark")));
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // tick a cada 2s para reavaliar "sinal perdido"
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 2000);
    return () => window.clearInterval(t);
  }, []);

  // ----------------------------------------------------------------
  // Snapshot inicial + polling de status (só para saber se o dono
  // encerrou — a posição atualizada vem do nosso próprio GPS local).
  // ----------------------------------------------------------------
  const fetchSnapshot = useCallback(async () => {
    if (!token) return;
    const { data, error: rpcErr } = await supabase
      .rpc("get_rastreio_publico", { p_token: token });
    if (rpcErr) {
      setErroFatal("Falha ao consultar o link. Verifique sua ligação e tente novamente.");
      return;
    }
    const row = Array.isArray(data) && data.length > 0 ? (data[0] as RastreioPublico) : null;
    if (!row) {
      setModo("erro-fatal");
      setErroFatal("Link inválido ou expirado.");
      return;
    }
    setRastreio(row);

    // Decidir o modo com base no estado actual + secret local
    const secretLocal = lerDeviceSecret(token);

    if (row.status === "concluida" || row.status === "finalizado") {
      setModo("concluida");
      if (secretLocal) apagarDeviceSecret(token);
      // Parar transmissão local se estivesse a correr
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (heartbeatTimerRef.current !== null) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      return;
    }

    // Já iniciado por algum device
    if (row.iniciado_em_dispositivo) {
      if (secretLocal) {
        // Presumo que é o mesmo device — confirma-se ao chamar iniciar_rastreio_publico
        // na primeira vez; aqui, se já estamos em modo tracking, não mexo.
        deviceSecretRef.current = secretLocal;
        if (modo === "loading" || modo === "pre-start") {
          // Tentar retomar silenciosamente
          void resumirRastreio(secretLocal);
        }
      } else {
        // Ninguém no localStorage → outro device já fez o lock
        setModo("locked-outro-device");
      }
      return;
    }

    // Ainda não iniciado por ninguém → mostrar botão
    if (modo === "loading") setModo("pre-start");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, modo]);

  useEffect(() => {
    void fetchSnapshot();
    const interval = window.setInterval(() => { void fetchSnapshot(); }, POLL_MS);
    return () => window.clearInterval(interval);
  }, [fetchSnapshot]);

  // ----------------------------------------------------------------
  // Função de envio de posição via RPC enviar_posicao_publico
  // ----------------------------------------------------------------
  const enviarPosicao = useCallback(
    async (pos: GeolocationPosition, ignorarThrottle = false) => {
      if (!token || !deviceSecretRef.current) return;
      const agora = Date.now();
      if (!ignorarThrottle && agora - lastSendTsRef.current < GPS_INTERVAL_MS - 500) return;
      if (sendInFlightRef.current) return;
      sendInFlightRef.current = true;
      try {
        const speedMs = pos.coords.speed ?? null;
        const speed_kmh = speedMs !== null && Number.isFinite(speedMs) ? speedMs * 3.6 : null;
        const { error: rpcErr } = await supabase.rpc("enviar_posicao_publico", {
          p_token: token,
          p_device_secret: deviceSecretRef.current,
          p_lat: pos.coords.latitude,
          p_lng: pos.coords.longitude,
          p_heading: pos.coords.heading ?? null,
          p_speed_kmh: speed_kmh,
          p_accuracy: pos.coords.accuracy ?? null,
          p_gravar_breadcrumb: true,
        });
        if (rpcErr) {
          setErroGps(rpcErr.message);
          return;
        }
        lastSendTsRef.current = agora;
        setLastGpsSentAt(new Date());
        setErroGps(null);
      } catch (e) {
        setErroGps(e instanceof Error ? e.message : "Falha ao enviar posição.");
      } finally {
        sendInFlightRef.current = false;
      }
    },
    [token],
  );

  // ----------------------------------------------------------------
  // Inicia a captura de GPS + heartbeat (chamado após lock OK)
  // ----------------------------------------------------------------
  const ligarGPS = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setErroGps("Este navegador não suporta geolocalização.");
      return;
    }

    if (watchIdRef.current !== null) return; // já ligado

    const onErroGeo = (err: GeolocationPositionError) => {
      const msg =
        err.code === err.PERMISSION_DENIED
          ? "Permissão de localização negada. Ative-a nas definições do navegador."
          : err.code === err.POSITION_UNAVAILABLE
            ? "Localização indisponível neste dispositivo (sem GPS/Wi-Fi?)."
            : err.code === err.TIMEOUT
              ? "Tempo esgotado a obter localização."
              : err.message;
      setErroGps(msg);
    };

    // 1) watchPosition — dispara com movimento
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => { void enviarPosicao(pos); },
      onErroGeo,
      {
        enableHighAccuracy: true,
        maximumAge: Math.floor(GPS_INTERVAL_MS / 2),
        timeout: 15_000,
      },
    );

    // 2) Heartbeat — força ping parado
    heartbeatTimerRef.current = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => { void enviarPosicao(pos); },
        onErroGeo,
        {
          enableHighAccuracy: true,
          maximumAge: GPS_INTERVAL_MS,
          timeout: 15_000,
        },
      );
    }, GPS_INTERVAL_MS);

    setModo("tracking");
  }, [enviarPosicao]);

  // Limpeza de GPS ao desmontar
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (heartbeatTimerRef.current !== null) window.clearInterval(heartbeatTimerRef.current);
    };
  }, []);

  // ----------------------------------------------------------------
  // Handler do botão "Iniciar viagem"
  // ----------------------------------------------------------------
  const handleIniciar = useCallback(async () => {
    if (!token) return;
    setErroIniciar(null);
    setModo("iniciando");

    // 1) Gerar secret (ou reutilizar se já existir por algum motivo)
    const secret = lerDeviceSecret(token) ?? gerarDeviceSecret();
    guardarDeviceSecret(token, secret);
    deviceSecretRef.current = secret;

    // 2) Chamar RPC para fazer o lock no servidor
    const { data, error: rpcErr } = await supabase.rpc("iniciar_rastreio_publico", {
      p_token: token,
      p_device_secret: secret,
      p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });

    if (rpcErr) {
      const msg = rpcErr.message || "";
      if (msg.includes("RASTREIO_JA_INICIADO_NOUTRO_DEVICE")) {
        apagarDeviceSecret(token);
        deviceSecretRef.current = null;
        setModo("locked-outro-device");
        return;
      }
      if (msg.includes("RASTREIO_NAO_ENCONTRADO")) {
        setModo("erro-fatal");
        setErroFatal("Link inválido ou expirado.");
        return;
      }
      if (msg.includes("RASTREIO_NAO_ATIVO")) {
        setModo("erro-fatal");
        setErroFatal("Este rastreio não está ativo no momento.");
        return;
      }
      setModo("pre-start");
      setErroIniciar(`Falha ao iniciar: ${msg}`);
      return;
    }

    // 3) Guardar meta-dados da RPC (row zero)
    const row = Array.isArray(data) && data.length > 0 ? data[0] as {
      rastreio_id: string;
      status: string;
      motorista_nome: string | null;
      veiculo_descricao: string | null;
      cliente_nome: string | null;
      categoria_rastreamento: string | null;
      iniciado_em_dispositivo: string;
      ja_iniciado_neste_device: boolean;
    } : null;
    if (row) {
      setRastreio((prev) => prev ? { ...prev, iniciado_em_dispositivo: row.iniciado_em_dispositivo } : prev);
    }

    // 4) Ligar GPS (pede permissão ao browser agora)
    ligarGPS();
  }, [token, ligarGPS]);

  // ----------------------------------------------------------------
  // Retomar rastreio silenciosamente (mesmo device, ao refrescar página)
  // ----------------------------------------------------------------
  const resumirRastreio = useCallback(
    async (secret: string) => {
      if (!token) return;
      const { error: rpcErr } = await supabase.rpc("iniciar_rastreio_publico", {
        p_token: token,
        p_device_secret: secret,
        p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
      if (rpcErr) {
        if ((rpcErr.message || "").includes("RASTREIO_JA_INICIADO_NOUTRO_DEVICE")) {
          apagarDeviceSecret(token);
          setModo("locked-outro-device");
          return;
        }
        setModo("pre-start");
        return;
      }
      deviceSecretRef.current = secret;
      ligarGPS();
    },
    [token, ligarGPS],
  );

  // ----------------------------------------------------------------
  // Render por modo
  // ----------------------------------------------------------------
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-sm text-muted-foreground">
        Link de rastreio inválido.
      </div>
    );
  }

  if (modo === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        A carregar…
      </div>
    );
  }

  if (modo === "erro-fatal") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Link indisponível</h1>
          <p className="text-sm text-muted-foreground">{erroFatal ?? "Link inválido."}</p>
          <p className="text-xs text-muted-foreground">
            Entre em contato com quem lhe enviou o link.
          </p>
        </div>
      </div>
    );
  }

  if (modo === "locked-outro-device") {
    return (
      <LockedScreen motivo="Esta viagem já foi iniciada noutro dispositivo. Um mesmo link só pode ser usado por um aparelho." />
    );
  }

  if (modo === "pre-start" || modo === "iniciando") {
    return (
      <PreStartScreen
        clienteNome={rastreio?.cliente_nome ?? null}
        motoristaNome={rastreio?.motorista_nome ?? null}
        veiculo={rastreio?.veiculo_descricao ?? null}
        onIniciar={() => { void handleIniciar(); }}
        iniciando={modo === "iniciando"}
        erroIniciar={erroIniciar}
      />
    );
  }

  if (modo === "concluida" && rastreio) {
    return <Resumo data={rastreio} />;
  }

  // --- modo === "tracking" --------------------------------------------------
  const position =
    rastreio?.latitude != null && rastreio?.longitude != null
      ? { lat: Number(rastreio.latitude), lng: Number(rastreio.longitude) }
      : null;

  const tsSend = lastGpsSentAt?.getTime() ?? 0;
  const tsColumn = rastreio?.ultima_atualizacao
    ? new Date(rastreio.ultima_atualizacao).getTime()
    : 0;
  const ultimaBatida = Math.max(tsSend, tsColumn);
  const tempoSemUpdate = ultimaBatida > 0 ? now - ultimaBatida : null;
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
    if (erroGps) return { label: erroGps, tone: "error" as const, Icon: WifiOff };
    if (!position) return { label: "À espera de posição…", tone: "idle" as const, Icon: Radio };
    if (sinalPerdido) return { label: "Sinal instável", tone: "error" as const, Icon: AlertTriangle };
    return { label: "Viagem em curso", tone: "live" as const, Icon: CheckCircle2 };
  })();
  const HudIcon = hud.Icon;

  const centerForMap = position ?? DEFAULT_CENTER;

  return (
    <div className="h-[100dvh] w-full bg-background flex flex-col overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="h-4 w-4 text-[#FF6600] shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">
              {rastreio?.cliente_nome ? `Olá, ${rastreio.cliente_nome}` : "Acompanhe sua viagem"}
            </div>
            {rastreio?.motorista_nome && (
              <div className="text-[11px] text-muted-foreground truncate">
                Motorista: {rastreio.motorista_nome}
                {rastreio?.veiculo_descricao ? ` · ${rastreio.veiculo_descricao}` : ""}
              </div>
            )}
          </div>
        </div>
        {lastGpsSentAt && (
          <div className="text-[11px] text-muted-foreground text-right">
            GPS: {lastGpsSentAt.toLocaleTimeString()}
          </div>
        )}
      </div>

      <div className="relative flex-1 min-h-0">
        <MapContainer
          center={[centerForMap.lat, centerForMap.lng]}
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
              position ? [position.lat, position.lng] : [centerForMap.lat, centerForMap.lng]
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
            "pointer-events-none absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur max-w-[90%]",
            hud.tone === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : hud.tone === "live"
                ? "border-[#FF6600]/40 bg-[#FF6600]/10 text-foreground"
                : "border-border bg-background/90",
          )}
          role="status"
          aria-live="polite"
        >
          <HudIcon
            className={cn(
              "h-3.5 w-3.5 shrink-0",
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
