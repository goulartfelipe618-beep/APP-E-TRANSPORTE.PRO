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
import { SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { clampPainelZoomPercent, usePainelContentZoom } from "@/contexts/PainelContentZoomContext";
import { cn } from "@/lib/utils";

/**
 * Zoom da área principal à direita (desktop). Fica no menu lateral, abaixo do tema claro/escuro.
 * Em telemóvel não aparece (viewport do painel mantém-se fixo).
 */
export default function PainelZoomHeaderButton() {
  const isMobile = useIsMobile();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { dialogOpen, setDialogOpen, draftZoom, setDraftZoom, saveZoom, saving, zoomPercent } = usePainelContentZoom();

  if (isMobile) return null;

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          type="button"
          className="w-full min-w-0"
          onClick={() => setDialogOpen(true)}
          tooltip="Zoom da área principal (conteúdo à direita)"
        >
          <ZoomIn className="mr-2 h-4 w-4 shrink-0" />
          {!collapsed ? (
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="min-w-0 truncate">Zoom</span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="text-xs tabular-nums text-muted-foreground">{zoomPercent}%</span>
                <PenLine className="h-4 w-4 shrink-0 text-[#FF6600]" aria-hidden />
              </span>
            </span>
          ) : null}
        </SidebarMenuButton>
      </SidebarMenuItem>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ZoomIn className="h-5 w-5 text-[#FF6600]" />
              Zoom da área principal
            </DialogTitle>
            <DialogDescription>
              A percentagem aplica-se a todo o conteúdo à direita do menu. Após salvar, o valor permanece até você
              alterar de novo.
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
                className={cn("h-2 w-full cursor-pointer accent-[#FF6600]")}
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
              {saving ? "A salvar…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
