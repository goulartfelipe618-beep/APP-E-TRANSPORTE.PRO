import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isMapboxConfigured, mapboxForwardGeocodeServiceAreas, type MapboxSuggestion } from "@/lib/mapboxGeocode";
import type { GbpServiceAreaPlace } from "@/lib/googleBusinessSolicitation";

const MAX_AREAS = 12;

type Props = {
  areas: GbpServiceAreaPlace[];
  onChange: (next: GbpServiceAreaPlace[]) => void;
  disabled?: boolean;
  className?: string;
};

export default function ServiceAreaMultiInput({ areas, onChange, disabled, className }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const runSearch = async (query: string) => {
    if (!isMapboxConfigured() || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const list = await mapboxForwardGeocodeServiceAreas(query);
      setSuggestions(list);
      setOpen(list.length > 0);
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (next: string) => {
    setQ(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(next), 350);
  };

  const addPlace = (s: MapboxSuggestion) => {
    if (areas.length >= MAX_AREAS) return;
    if (areas.some((a) => a.id === s.id)) {
      setOpen(false);
      setQ("");
      setSuggestions([]);
      return;
    }
    onChange([
      ...areas,
      {
        id: s.id,
        label: s.place_name,
        lat: s.lat,
        lng: s.lng,
      },
    ]);
    setQ("");
    setSuggestions([]);
    setOpen(false);
  };

  const removeAt = (idx: number) => {
    onChange(areas.filter((_, i) => i !== idx));
  };

  const configured = isMapboxConfigured();

  return (
    <div className={cn("space-y-2", className)}>
      <div ref={wrapRef} className="relative">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder={
              configured
                ? "Busque cidade, bairro ou região (Brasil)…"
                : "Configure VITE_MAPBOX_ACCESS_TOKEN para busca de áreas"
            }
            value={q}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => {
              if (suggestions.length) setOpen(true);
            }}
            disabled={disabled || !configured || areas.length >= MAX_AREAS}
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {open && suggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => addPlace(s)}
                >
                  {s.place_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Adicione as cidades ou regiões onde você atende (até {MAX_AREAS}). Use buscas realistas próximas ao seu endereço base.
      </p>
      {areas.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {areas.map((a, idx) => (
            <Badge key={a.id} variant="secondary" className="gap-1 pr-1 max-w-full">
              <span className="truncate max-w-[220px]" title={a.label}>{a.label}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={() => removeAt(idx)}
                disabled={disabled}
                aria-label="Remover área"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
