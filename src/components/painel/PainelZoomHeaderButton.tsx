import { PenLine, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import { clampPainelZoomPercent, usePainelContentZoom } from "@/contexts/PainelContentZoomContext";

/**
 * Controlo de zoom da área principal (desktop). Em telemóvel/tablet compacto não aparece.
 */
export default function PainelZoomHeaderButton() {
  const isMobile = useIsMobile();
  const { dialogOpen, setDialogOpen, draftZoom, setDraftZoom, saveZoom, saving, zoomPercent } = usePainelContentZoom();

  if (isMobile) return null;

  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5">
        <ZoomIn className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="hidden text-xs text-muted-foreground sm:inline">Zoom</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 border-[#FF6600]/40 text-foreground hover:bg-[#FF6600]/10"
          title="Ajustar zoom da área de conteúdo (portátil / desktop)"
          onClick={() => setDialogOpen(true)}
        >
          <PenLine className="h-4 w-4" />
          <span className="sr-only">Editar zoom do painel</span>
        </Button>
        <span className="hidden text-xs tabular-nums text-muted-foreground md:inline">{zoomPercent}%</span>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ZoomIn className="h-5 w-5 text-[#FF6600]" />
              Zoom da área principal
            </DialogTitle>
            <DialogDescription>
              Reduzir a percentagem mostra mais colunas nas tabelas (efeito visual no painel à direita). O valor fica
              guardado na sua conta até alterar novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="painel-zoom-range">Escala</Label>
                <span className="text-sm font-semibold tabular-nums text-[#FF6600]">{draftZoom}%</span>
              </div>
              <input
                id="painel-zoom-range"
                type="range"
                min={70}
                max={100}
                step={1}
                value={draftZoom}
                onChange={(e) => setDraftZoom(clampPainelZoomPercent(Number(e.target.value)))}
                className="h-2 w-full cursor-pointer accent-[#FF6600]"
              />
              <p className="text-xs text-muted-foreground">Entre 70 % (mais conteúdo visível) e 100 % (tamanho normal).</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-[#FF6600] font-semibold text-white hover:bg-[#e65c00]"
              disabled={saving}
              onClick={() => void saveZoom()}
            >
              {saving ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
