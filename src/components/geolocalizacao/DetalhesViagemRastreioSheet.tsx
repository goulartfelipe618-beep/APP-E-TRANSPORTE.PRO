import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import ResumoViagemCard from "./ResumoViagemCard";
import type { Tables } from "@/integrations/supabase/types";
import { buildRastreioShareUrl } from "@/lib/appPublicUrl";

type RastreioRow = Tables<"rastreios_ao_vivo">;

function mapsLink(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

interface Props {
  rastreio: RastreioRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DetalhesViagemRastreioSheet({ rastreio, open, onOpenChange }: Props) {
  if (!rastreio) return null;

  const urlPublica = buildRastreioShareUrl(rastreio.token);
  const linkInicio = mapsLink(rastreio.inicio_latitude, rastreio.inicio_longitude);
  const linkFim = mapsLink(rastreio.fim_latitude, rastreio.fim_longitude);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Detalhes da viagem</SheetTitle>
          <p className="text-left text-sm text-muted-foreground font-normal">
            Apenas o criador do link (a sua conta) vê estes dados na lista de geolocalização.
          </p>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <ResumoViagemCard rastreio={rastreio} />

          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Link público (partilhado com o cliente)</p>
            <p className="break-all text-xs text-muted-foreground">{urlPublica}</p>
            <Button type="button" variant="outline" size="sm" className="w-full gap-2" asChild>
              <a href={urlPublica} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir página do rastreio
              </a>
            </Button>
          </div>

          {(linkInicio || linkFim) && (
            <div className="flex flex-col gap-2">
              {linkInicio && (
                <Button type="button" variant="outline" size="sm" className="justify-start gap-2" asChild>
                  <a href={linkInicio} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    Google Maps — início do trajeto
                  </a>
                </Button>
              )}
              {linkFim && (
                <Button type="button" variant="outline" size="sm" className="justify-start gap-2" asChild>
                  <a href={linkFim} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    Google Maps — fim do trajeto
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
