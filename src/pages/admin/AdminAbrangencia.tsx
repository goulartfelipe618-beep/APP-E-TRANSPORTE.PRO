import { useState, useEffect, useCallback } from "react";
import { MapPin, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import "leaflet/dist/leaflet.css";
import { nominatimGeocode, nominatimDelayMs } from "@/lib/nominatimGeocode";
import { chunk, findCoords, sleep } from "@/lib/abrangenciaMapHelpers";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

type LocSource = "mapbox" | "lista" | "osm";

interface MotoristaPin {
  userId: string;
  nome: string;
  email: string;
  cidade: string;
  estado: string;
  nomeEmpresa: string;
  enderecoCompleto: string;
  coords: [number, number];
  preciso: boolean;
  locSource: LocSource;
}

export default function AdminAbrangencia() {
  const [pins, setPins] = useState<MotoristaPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [citySummary, setCitySummary] = useState<{ cidade: string; count: number }[]>([]);
  const [totalMotoristas, setTotalMotoristas] = useState(0);
  const [comCoordenadaMapbox, setComCoordenadaMapbox] = useState(0);
  const [pinsOsm, setPinsOsm] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: roles, error: roleErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin_transfer");

      if (roleErr) {
        console.error(roleErr);
        setPins([]);
        setTotalMotoristas(0);
        setPinsOsm(0);
        return;
      }

      const userIds = [...new Set((roles || []).map((r) => r.user_id).filter(Boolean))] as string[];
      if (userIds.length === 0) {
        setPins([]);
        setCitySummary([]);
        setTotalMotoristas(0);
        setComCoordenadaMapbox(0);
        setPinsOsm(0);
        return;
      }

      const allRows: Record<string, any>[] = [];
      for (const part of chunk(userIds, 120)) {
        const { data: rows, error: cfgErr } = await supabase
          .from("configuracoes")
          .select(
            "user_id, nome_completo, cidade, estado, nome_empresa, email, endereco_completo, endereco_latitude, endereco_longitude"
          )
          .in("user_id", part);
        if (cfgErr) {
          console.error(cfgErr);
          continue;
        }
        allRows.push(...(rows || []));
      }

      const mapped: MotoristaPin[] = [];
      const counts: Record<string, number> = {};
      let mapboxCount = 0;
      const pendingOsm: Record<string, any>[] = [];
      const jitter = () => (Math.random() - 0.5) * 0.02;

      const addPin = (
        m: Record<string, any>,
        coords: [number, number],
        preciso: boolean,
        locSource: LocSource,
      ) => {
        const cidade = (m.cidade || "").trim();
        const labelCidade = cidade || "Sem cidade";
        counts[labelCidade] = (counts[labelCidade] || 0) + 1;
        mapped.push({
          userId: m.user_id,
          nome: m.nome_completo || "Sem nome",
          email: m.email || "—",
          cidade: labelCidade,
          estado: m.estado || "",
          nomeEmpresa: m.nome_empresa || "",
          enderecoCompleto: m.endereco_completo || "",
          coords,
          preciso,
          locSource,
        });
      };

      for (const m of allRows) {
        const lat =
          m.endereco_latitude != null && !Number.isNaN(Number(m.endereco_latitude))
            ? Number(m.endereco_latitude)
            : null;
        const lng =
          m.endereco_longitude != null && !Number.isNaN(Number(m.endereco_longitude))
            ? Number(m.endereco_longitude)
            : null;

        const cidade = (m.cidade || "").trim();
        let coords: [number, number] | null = null;

        if (lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          coords = [lat, lng];
          mapboxCount++;
          addPin(m, coords, true, "mapbox");
          continue;
        }

        if (cidade) {
          const c = findCoords(cidade);
          if (c) {
            coords = [c[0] + jitter(), c[1] + jitter()];
            addPin(m, coords, false, "lista");
            continue;
          }
        }

        if (cidade) pendingOsm.push(m);
      }

      let osmCount = 0;
      for (const m of pendingOsm) {
        await sleep(nominatimDelayMs());
        const cidade = (m.cidade || "").trim();
        const estado = (m.estado || "").trim();
        const labelCidade = cidade || "Sem cidade";
        const parts = [labelCidade, estado, "Brasil"].filter((p) => p.length > 0);
        let pair = await nominatimGeocode(parts.join(", "));
        if (!pair && m.endereco_completo?.trim()) {
          await sleep(nominatimDelayMs());
          pair = await nominatimGeocode(`${String(m.endereco_completo).trim()}, ${parts.join(", ")}`);
        }
        if (pair) {
          const coords: [number, number] = [pair[0] + jitter(), pair[1] + jitter()];
          osmCount++;
          addPin(m, coords, false, "osm");
        }
      }

      setPins(mapped);
      setTotalMotoristas(allRows.length);
      setComCoordenadaMapbox(mapboxCount);
      setPinsOsm(osmCount);
      setCitySummary(
        Object.entries(counts)
          .map(([cidade, count]) => ({ cidade, count }))
          .sort((a, b) => b.count - a.count)
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const channel = supabase
      .channel("admin-abrangencia-config")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "configuracoes" },
        () => {
          void fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
            Abrangência — Motoristas executivos
          </h1>
          <p className="text-muted-foreground mt-1">
            Mapa com todos os utilizadores <strong className="font-medium text-foreground">Motorista Executivo</strong>,
            com base no endereço de <strong className="font-medium text-foreground">Meu Perfil</strong>. Coordenadas
            exatas quando o motorista escolhe um endereço na lista Mapbox; senão, tentamos a cidade numa lista interna
            ou busca automática (OpenStreetMap).
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void fetchData()} title="Atualizar mapa">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-border overflow-hidden" style={{ height: 500 }}>
          <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {pins.map((pin) => (
              <Marker key={pin.userId} position={pin.coords}>
                <Popup>
                  <div className="text-sm max-w-[240px]">
                    <strong>{pin.nome}</strong>
                    <br />
                    <span className="text-muted-foreground">{pin.email}</span>
                    <br />
                    🏢 {pin.nomeEmpresa || "—"}
                    <br />
                    📍 {pin.cidade}
                    {pin.estado ? ` - ${pin.estado}` : ""}
                    {pin.enderecoCompleto ? (
                      <>
                        <br />
                        <span className="text-xs text-muted-foreground">{pin.enderecoCompleto}</span>
                      </>
                    ) : null}
                    <br />
                    <span className="text-xs">
                      {pin.locSource === "mapbox" && "📌 Localização precisa (Mapbox)"}
                      {pin.locSource === "lista" && "📍 Aproximação por cidade (lista interna)"}
                      {pin.locSource === "osm" && "📍 Aproximação (OpenStreetMap)"}
                    </span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-foreground mb-4">Motoristas por cidade</h3>
          {citySummary.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum motorista com cidade preenchida ou localização resolvida. Confirme cidade/UF em Meu Perfil; com
              token Mapbox, peça para escolher o endereço na lista de sugestões.
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
              Perfis (Motorista Exec.):{" "}
              <span className="font-semibold text-foreground">{totalMotoristas}</span>
            </p>
            <p>
              Pins no mapa: <span className="font-semibold text-foreground">{pins.length}</span>
            </p>
            <p>
              Com coordenada Mapbox:{" "}
              <span className="font-semibold text-foreground">{comCoordenadaMapbox}</span>
            </p>
            <p>
              Por busca OpenStreetMap:{" "}
              <span className="font-semibold text-foreground">{pinsOsm}</span>
            </p>
            <p>
              Cidades no resumo:{" "}
              <span className="font-semibold text-foreground">{citySummary.length}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
