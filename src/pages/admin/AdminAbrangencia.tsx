import { useState, useEffect } from "react";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Known Brazilian cities → approximate coordinates
const cityCoords: Record<string, [number, number]> = {
  "são paulo": [-23.5505, -46.6333],
  "rio de janeiro": [-22.9068, -43.1729],
  "belo horizonte": [-19.9167, -43.9345],
  "brasília": [-15.7939, -47.8828],
  "curitiba": [-25.4284, -49.2733],
  "salvador": [-12.9714, -38.5124],
  "fortaleza": [-3.7172, -38.5433],
  "recife": [-8.0476, -34.877],
  "porto alegre": [-30.0346, -51.2177],
  "manaus": [-3.119, -60.0217],
  "belém": [-1.4558, -48.5024],
  "goiânia": [-16.6869, -49.2648],
  "guarulhos": [-23.4538, -46.5333],
  "campinas": [-22.9099, -47.0626],
  "santos": [-23.9608, -46.3336],
  "florianópolis": [-27.5954, -48.548],
  "vitória": [-20.3155, -40.3128],
  "natal": [-5.7945, -35.211],
  "campo grande": [-20.4697, -54.6201],
  "teresina": [-5.0892, -42.8019],
  "joão pessoa": [-7.1195, -34.845],
  "maceió": [-9.6658, -35.7353],
  "aracaju": [-10.9091, -37.0677],
  "cuiabá": [-15.601, -56.0974],
  "são luís": [-2.5297, -44.2825],
  "londrina": [-23.3045, -51.1696],
  "niterói": [-22.8833, -43.1036],
  "uberlândia": [-18.9186, -48.2772],
  "ribeirão preto": [-21.1704, -47.8103],
  "sorocaba": [-23.5015, -47.4526],
  "joinville": [-26.3045, -48.8487],
  "osasco": [-23.5325, -46.7917],
  "são josé dos campos": [-23.1896, -45.884],
  "maringá": [-23.4205, -51.9333],
  "piracicaba": [-22.7338, -47.6476],
  "jundiaí": [-23.1857, -46.8978],
  "bauru": [-22.3246, -49.0871],
  "são bernardo do campo": [-23.6914, -46.5646],
  "santo andré": [-23.6737, -46.5432],
  "são josé do rio preto": [-20.8113, -49.3758],
};

function findCoords(city: string): [number, number] | null {
  const normalized = city.toLowerCase().trim();
  if (cityCoords[normalized]) return cityCoords[normalized];
  // Partial match
  for (const [key, coords] of Object.entries(cityCoords)) {
    if (normalized.includes(key) || key.includes(normalized)) return coords;
  }
  return null;
}

interface MotoristaPin {
  nome: string;
  cidade: string;
  coords: [number, number];
}

export default function AdminAbrangencia() {
  const [pins, setPins] = useState<MotoristaPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [citySummary, setCitySummary] = useState<{ cidade: string; count: number }[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("solicitacoes_motoristas")
        .select("nome, cidade");

      if (!data) { setLoading(false); return; }

      const mapped: MotoristaPin[] = [];
      const counts: Record<string, number> = {};

      for (const m of data) {
        const cidade = m.cidade?.trim() || "Não informado";
        counts[cidade] = (counts[cidade] || 0) + 1;
        const coords = findCoords(cidade);
        if (coords) {
          // Add small random offset to avoid overlapping pins
          const offset = () => (Math.random() - 0.5) * 0.02;
          mapped.push({ nome: m.nome, cidade, coords: [coords[0] + offset(), coords[1] + offset()] });
        }
      }

      setPins(mapped);
      setCitySummary(
        Object.entries(counts)
          .map(([cidade, count]) => ({ cidade, count }))
          .sort((a, b) => b.count - a.count)
      );
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" />
          Abrangência — Motoristas Cadastrados
        </h1>
        <p className="text-muted-foreground mt-1">Visualize no mapa onde estão os motoristas registrados na plataforma.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 rounded-xl border border-border overflow-hidden" style={{ height: 500 }}>
          <MapContainer
            center={[-14.235, -51.9253]}
            zoom={4}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {pins.map((pin, i) => (
              <Marker key={i} position={pin.coords}>
                <Popup>
                  <strong>{pin.nome}</strong><br />
                  📍 {pin.cidade}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Summary */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-foreground mb-4">Motoristas por Cidade</h3>
          {citySummary.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum motorista cadastrado ainda.</p>
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
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{pins.length}</span> motoristas no mapa
            </p>
            <p className="text-sm text-muted-foreground">
              Cidades: <span className="font-semibold text-foreground">{citySummary.length}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
