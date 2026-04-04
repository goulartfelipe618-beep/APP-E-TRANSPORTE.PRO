import { useState, useEffect, useCallback, useMemo } from "react";
import { MapPin, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import "leaflet/dist/leaflet.css";
import { nominatimGeocode, nominatimDelayMs } from "@/lib/nominatimGeocode";
import { findCoords, primeiroSegmentoEndereco, sleep } from "@/lib/abrangenciaMapHelpers";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

/** Ícone verde com ✓ — atendimento realizado (reserva concluída). */
const iconConcluida = L.divIcon({
  className: "motorista-abrangencia-pin-concluida",
  html: `<div style="background:#16a34a;width:28px;height:28px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:bold;">✓</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -12],
});

type LocSource = "lista" | "osm";

type ReservaPin = {
  reservaKey: string;
  reservaId: string;
  kind: "transfer" | "grupo";
  numeroReserva: number;
  clienteNome: string;
  status: string;
  concluida: boolean;
  coords: [number, number];
  locSource: LocSource;
  embarqueReferencia: string;
  tipoLabel: string;
  resumoTrajeto: string;
  cidadeResumo: string;
};

type ReservaPendente = {
  reservaKey: string;
  reservaId: string;
  kind: "transfer" | "grupo";
  numeroReserva: number;
  clienteNome: string;
  status: string;
  concluida: boolean;
  enderecoGeocode: string;
  embarqueReferencia: string;
  tipoLabel: string;
  resumoTrajeto: string;
  cidadeResumo: string;
};

function getPrimeiroEmbarqueTransfer(r: Tables<"reservas_transfer">): string | null {
  let raw: string | null = null;
  if (r.tipo_viagem === "por_hora") {
    raw = r.por_hora_endereco_inicio?.trim() || null;
  } else {
    raw = r.ida_embarque?.trim() || null;
  }
  if (!raw) return null;
  const seg = primeiroSegmentoEndereco(raw);
  return seg || null;
}

function getPrimeiroEmbarqueGrupo(r: Tables<"reservas_grupos">): string | null {
  const raw = r.embarque?.trim();
  if (!raw) return null;
  const seg = primeiroSegmentoEndereco(raw);
  return seg || null;
}

function isReservaConcluida(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase().trim();
  if (!s) return false;
  const keys = ["concluí", "concluid", "realiz", "finaliz", "complet", "feito", "atend", "encerr"];
  return keys.some((k) => s.includes(k));
}

function labelTransfer(r: Tables<"reservas_transfer">): string {
  if (r.tipo_viagem === "por_hora") {
    const a = primeiroSegmentoEndereco(r.por_hora_endereco_inicio) || "—";
    const b = (r.por_hora_ponto_encerramento || "").trim() || "—";
    return `${a} → ${b}`;
  }
  const a = primeiroSegmentoEndereco(r.ida_embarque) || "—";
  const b = (r.ida_desembarque || "").trim() || "—";
  return `${a} → ${b}`;
}

function labelGrupo(r: Tables<"reservas_grupos">): string {
  const a = primeiroSegmentoEndereco(r.embarque) || "—";
  const b = (r.destino || "").trim() || "—";
  return `${a} → ${b}`;
}

function cidadeFromEmbarque(embarque: string): string {
  const first = embarque.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "Sem localização";
}

/** Reserva atribuída ao motorista OU criada por ele sem outro motorista definido. */
function transferVisivelMotoristaExecutivo(r: Tables<"reservas_transfer">, userId: string): boolean {
  const mid = (r.motorista_id ?? "").trim();
  if (mid === userId) return true;
  if (r.user_id === userId && mid === "") return true;
  return false;
}

function grupoVisivelMotoristaExecutivo(r: Tables<"reservas_grupos">, userId: string): boolean {
  if (r.motorista_id != null && r.motorista_id === userId) return true;
  if (r.user_id === userId && r.motorista_id == null) return true;
  return false;
}

/** Fallback quando a RPC ainda não foi aplicada ou retorna vazio. */
async function loadReservasViaFallback(userId: string): Promise<{
  transfers: Tables<"reservas_transfer">[];
  grupos: Tables<"reservas_grupos">[];
}> {
  const [tRes, gRes] = await Promise.all([
    supabase.from("reservas_transfer").select("*").or(`motorista_id.eq.${userId},user_id.eq.${userId}`),
    supabase.from("reservas_grupos").select("*").or(`motorista_id.eq.${userId},user_id.eq.${userId}`),
  ]);
  if (tRes.error) throw tRes.error;
  if (gRes.error) throw gRes.error;
  const transfers = ((tRes.data || []) as Tables<"reservas_transfer">[]).filter((r) =>
    transferVisivelMotoristaExecutivo(r, userId),
  );
  const grupos = ((gRes.data || []) as Tables<"reservas_grupos">[]).filter((r) =>
    grupoVisivelMotoristaExecutivo(r, userId),
  );
  return { transfers, grupos };
}

/** RPC security definer + regras operador/motorista (ver migration). */
async function loadReservasAtribuidas(userId: string): Promise<{
  transfers: Tables<"reservas_transfer">[];
  grupos: Tables<"reservas_grupos">[];
}> {
  const { data: rpcData, error: rpcErr } = await supabase.rpc("get_motorista_abrangencia_reservas");
  if (!rpcErr && rpcData != null && typeof rpcData === "object") {
    const raw = rpcData as { transfer?: unknown; grupos?: unknown };
    const transfers = Array.isArray(raw.transfer) ? (raw.transfer as Tables<"reservas_transfer">[]) : [];
    const grupos = Array.isArray(raw.grupos) ? (raw.grupos as Tables<"reservas_grupos">[]) : [];
    if (transfers.length + grupos.length > 0) {
      return { transfers, grupos };
    }
  }
  return loadReservasViaFallback(userId);
}

export default function MotoristaAbrangencia() {
  const [pins, setPins] = useState<ReservaPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [citySummary, setCitySummary] = useState<{ cidade: string; count: number }[]>([]);
  const [totalReservas, setTotalReservas] = useState(0);
  const [pinsLista, setPinsLista] = useState(0);
  const [pinsOsm, setPinsOsm] = useState(0);
  /** Total de reservas (transfer+grupo) com motorista_id = você, antes de filtrar embarque/geocódigo */
  const [atribuidasNoBanco, setAtribuidasNoBanco] = useState<number | null>(null);

  const jitter = useMemo(() => () => (Math.random() - 0.5) * 0.02, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPins([]);
        setCitySummary([]);
        setTotalReservas(0);
        setPinsLista(0);
        setPinsOsm(0);
        setAtribuidasNoBanco(null);
        return;
      }

      let transfers: Tables<"reservas_transfer">[] = [];
      let grupos: Tables<"reservas_grupos">[] = [];
      try {
        const loaded = await loadReservasAtribuidas(user.id);
        transfers = loaded.transfers;
        grupos = loaded.grupos;
        setAtribuidasNoBanco(transfers.length + grupos.length);
      } catch (e) {
        console.error(e);
        setAtribuidasNoBanco(null);
        toast.error("Não foi possível carregar suas reservas.", {
          description: "Confirme se as migrations do Supabase foram aplicadas (RPC get_motorista_abrangencia_reservas).",
        });
      }

      const pendentes: ReservaPendente[] = [];

      for (const r of transfers) {
        const emb = getPrimeiroEmbarqueTransfer(r);
        if (!emb) continue;
        pendentes.push({
          reservaKey: `transfer:${r.id}`,
          reservaId: r.id,
          kind: "transfer",
          numeroReserva: r.numero_reserva,
          clienteNome: r.nome_completo || "—",
          status: r.status || "",
          concluida: isReservaConcluida(r.status),
          enderecoGeocode: emb,
          embarqueReferencia: emb,
          tipoLabel: "Transfer",
          resumoTrajeto: labelTransfer(r),
          cidadeResumo: cidadeFromEmbarque(emb),
        });
      }

      for (const r of grupos) {
        const emb = getPrimeiroEmbarqueGrupo(r);
        if (!emb) continue;
        pendentes.push({
          reservaKey: `grupo:${r.id}`,
          reservaId: r.id,
          kind: "grupo",
          numeroReserva: r.numero_reserva,
          clienteNome: r.nome_completo || "—",
          status: r.status || "",
          concluida: isReservaConcluida(r.status),
          enderecoGeocode: emb,
          embarqueReferencia: emb,
          tipoLabel: "Grupo",
          resumoTrajeto: labelGrupo(r),
          cidadeResumo: cidadeFromEmbarque(emb),
        });
      }

      setTotalReservas(pendentes.length);

      const mapped: ReservaPin[] = [];
      const counts: Record<string, number> = {};
      const pendingOsm: ReservaPendente[] = [];
      let listaCount = 0;
      let osmCount = 0;

      const bumpCity = (label: string) => {
        counts[label] = (counts[label] || 0) + 1;
      };

      for (const p of pendentes) {
        const addr = p.enderecoGeocode;
        let coords: [number, number] | null = null;

        const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
        for (const part of parts) {
          const c = findCoords(part);
          if (c) {
            coords = [c[0] + jitter(), c[1] + jitter()];
            break;
          }
        }
        if (!coords) {
          const c = findCoords(addr);
          if (c) coords = [c[0] + jitter(), c[1] + jitter()];
        }

        if (coords) {
          listaCount++;
          bumpCity(p.cidadeResumo);
          mapped.push({
            reservaKey: p.reservaKey,
            reservaId: p.reservaId,
            kind: p.kind,
            numeroReserva: p.numeroReserva,
            clienteNome: p.clienteNome,
            status: p.status,
            concluida: p.concluida,
            coords,
            locSource: "lista",
            embarqueReferencia: p.embarqueReferencia,
            tipoLabel: p.tipoLabel,
            resumoTrajeto: p.resumoTrajeto,
            cidadeResumo: p.cidadeResumo,
          });
          continue;
        }
        pendingOsm.push(p);
      }

      for (const p of pendingOsm) {
        await sleep(nominatimDelayMs());
        let pair = await nominatimGeocode(`${p.enderecoGeocode}, Brasil`);
        if (!pair && p.enderecoGeocode.includes(",")) {
          await sleep(nominatimDelayMs());
          pair = await nominatimGeocode(p.enderecoGeocode);
        }
        if (pair) {
          osmCount++;
          bumpCity(p.cidadeResumo);
          mapped.push({
            reservaKey: p.reservaKey,
            reservaId: p.reservaId,
            kind: p.kind,
            numeroReserva: p.numeroReserva,
            clienteNome: p.clienteNome,
            status: p.status,
            concluida: p.concluida,
            coords: [pair[0] + jitter(), pair[1] + jitter()],
            locSource: "osm",
            embarqueReferencia: p.embarqueReferencia,
            tipoLabel: p.tipoLabel,
            resumoTrajeto: p.resumoTrajeto,
            cidadeResumo: p.cidadeResumo,
          });
        }
      }

      setPins(mapped);
      setPinsLista(listaCount);
      setPinsOsm(osmCount);
      setCitySummary(
        Object.entries(counts)
          .map(([cidade, count]) => ({ cidade, count }))
          .sort((a, b) => b.count - a.count),
      );
    } finally {
      setLoading(false);
    }
  }, [jitter]);

  useEffect(() => {
    void fetchData();
    const id = window.setInterval(() => void fetchData(), 90_000);
    return () => window.clearInterval(id);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const center: [number, number] =
    pins.length === 1
      ? pins[0].coords
      : pins.length > 0
        ? [
            pins.reduce((s, p) => s + p.coords[0], 0) / pins.length,
            pins.reduce((s, p) => s + p.coords[1], 0) / pins.length,
          ]
        : [-14.235, -51.9253];

  const zoom = pins.length === 0 ? 4 : pins.length === 1 ? 12 : 5;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Abrangência — Minhas viagens
          </h1>
          <p className="text-muted-foreground mt-1">
            Mapa com as viagens nas quais você possui <strong className="font-medium text-foreground">reserva registrada</strong>.
            Cada reserva gera <strong className="font-medium text-foreground">um único PIN</strong>, usando apenas o{" "}
            <strong className="font-medium text-foreground">primeiro endereço de embarque</strong> (se houver vários pontos no mesmo
            campo, só o primeiro conta; Transfer: ida ou início “por hora”; Grupos: embarque).
            Reservas concluídas continuam no mapa com pin de <strong className="font-medium text-foreground">atendimento realizado</strong>.
            Coordenadas: lista interna de cidades quando possível; senão busca automática (OpenStreetMap).
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void fetchData()} title="Atualizar mapa">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {atribuidasNoBanco === 0 ? (
        <Alert>
          <AlertTitle>Nenhuma reserva vinculada à sua conta</AlertTitle>
          <AlertDescription>
            O mapa lista viagens em que você é o <strong className="text-foreground">motorista atribuído</strong> ou em que você
            criou a reserva e ainda não há outro motorista definido. Se nada aparecer, confira os endereços de embarque e as
            migrations no Supabase (RPC <span className="font-mono text-xs">get_motorista_abrangencia_reservas</span>).
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-border overflow-hidden" style={{ height: 500 }}>
          <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {pins.map((pin) => (
              <Marker key={pin.reservaKey} position={pin.coords} icon={pin.concluida ? iconConcluida : undefined}>
                <Popup>
                  <div className="text-sm max-w-[240px]">
                    <strong>
                      #{pin.numeroReserva} · {pin.tipoLabel}
                    </strong>
                    {pin.concluida ? (
                      <>
                        <br />
                        <span className="text-green-600 font-medium">Atendimento realizado</span>
                      </>
                    ) : null}
                    <br />
                    <span className="text-muted-foreground">{pin.clienteNome}</span>
                    <br />
                    📍 {pin.embarqueReferencia}
                    <br />
                    <span className="text-xs text-muted-foreground">{pin.resumoTrajeto}</span>
                    <br />
                    <span className="text-xs">Status: {pin.status || "—"}</span>
                    <br />
                    <span className="text-xs">
                      {pin.locSource === "lista" && "📍 Aproximação por cidade (lista interna)"}
                      {pin.locSource === "osm" && "📍 Geocodificação (OpenStreetMap)"}
                    </span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-foreground mb-4">Reservas por cidade</h3>
          {citySummary.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma reserva atribuída a você com local de embarque da primeira partida preenchido, ou não foi possível
              localizar no mapa. Confira se o operador atribuiu a reserva ao seu perfil e se o endereço de embarque está
              completo.
            </p>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
              {citySummary.map((item, i) => {
                const maxCount = citySummary[0]?.count || 1;
                const pct = (item.count / maxCount) * 100;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-foreground truncate mr-2">{item.cidade}</span>
                      <span className="text-muted-foreground font-medium">{item.count}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-border space-y-1 text-sm text-muted-foreground">
            <p>
              Reservas atribuídas: <span className="font-semibold text-foreground">{totalReservas}</span>
            </p>
            <p>
              Pins no mapa: <span className="font-semibold text-foreground">{pins.length}</span>
            </p>
            <p>
              Aproximação por cidade (lista): <span className="font-semibold text-foreground">{pinsLista}</span>
            </p>
            <p>
              Por busca OpenStreetMap: <span className="font-semibold text-foreground">{pinsOsm}</span>
            </p>
            <p>
              Cidades no resumo: <span className="font-semibold text-foreground">{citySummary.length}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
