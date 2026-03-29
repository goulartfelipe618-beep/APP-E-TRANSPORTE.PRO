import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { isMapboxConfigured, mapboxForwardGeocode, type MapboxSuggestion } from "@/lib/mapboxGeocode";

type Props = {
  value: string;
  onChangeAddress: (value: string) => void;
  onCoordinatesChange: (lat: number | null, lng: number | null) => void;
  /** Quando o motorista escolhe uma sugestão, pode atualizar cidade/UF automaticamente. */
  onPlaceContext?: (cidade: string | null, estado: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export default function MapboxAddressInput({
  value,
  onChangeAddress,
  onCoordinatesChange,
  onPlaceContext,
  disabled,
  placeholder = "Busque rua, número, bairro, cidade…",
  className,
}: Props) {
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

  const runSearch = async (q: string) => {
    if (!isMapboxConfigured() || q.trim().length < 4) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const list = await mapboxForwardGeocode(q);
      setSuggestions(list);
      setOpen(list.length > 0);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (next: string) => {
    onChangeAddress(next);
    onCoordinatesChange(null, null);
    onPlaceContext?.(null, null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(next), 400);
  };

  const pick = (s: MapboxSuggestion) => {
    onChangeAddress(s.place_name);
    onCoordinatesChange(s.lat, s.lng);
    if (s.cidade || s.estado) onPlaceContext?.(s.cidade ?? null, s.estado ?? null);
    setOpen(false);
    setSuggestions([]);
  };

  const configured = isMapboxConfigured();

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9"
          placeholder={configured ? placeholder : "Configure o token Mapbox (.env) para busca de endereço"}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length) setOpen(true);
          }}
          disabled={disabled || !configured}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => pick(s)}
              >
                {s.place_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
