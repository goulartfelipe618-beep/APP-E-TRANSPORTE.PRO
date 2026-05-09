import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { isMapboxConfigured } from "@/lib/mapboxGeocode";
import { resolveAddressViaMapbox } from "@/lib/mapboxResolveAddress";
import { toast } from "sonner";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  inputClassName?: string;
};

/**
 * Campo de endereço sem autocomplete: o utilizador escreve e clica no pin para
 * substituir pelo endereço normalizado do Mapbox (melhor geocoding no PDF).
 */
export default function MapboxNormalizeAddressField({
  value,
  onChange,
  placeholder = "Digite o endereço…",
  required,
  disabled,
  id,
  className,
  inputClassName,
}: Props) {
  const [busy, setBusy] = useState(false);
  const configured = isMapboxConfigured();

  const normalize = async () => {
    const q = value.trim();
    if (!configured) {
      toast.error("Configure VITE_MAPBOX_ACCESS_TOKEN para normalizar endereços.");
      return;
    }
    if (q.length < 3) {
      toast.error("Escreva pelo menos 3 caracteres antes de normalizar.");
      return;
    }
    setBusy(true);
    try {
      const hit = await resolveAddressViaMapbox(q);
      if (!hit) {
        toast.error("Não encontrámos este endereço no Mapbox. Tente ser mais específico.");
        return;
      }
      onChange(hit.placeName);
      toast.success("Endereço confirmado pelo Mapbox.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex gap-2 items-center">
        <Input
          id={id}
          className={cn("min-w-0 flex-1", inputClassName)}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 border-[#FF6600]/40 text-[#FF6600] hover:bg-[#FF6600]/10"
          disabled={disabled || busy || !configured}
          onClick={() => void normalize()}
          title="Confirmar endereço no Mapbox (melhora o mapa no PDF)"
          aria-label="Confirmar endereço no Mapbox"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
