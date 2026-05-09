import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePainelContentZoom } from "@/contexts/PainelContentZoomContext";

/**
 * Aplica escala só em desktop (acima do breakpoint do painel); mobile mantém 100 %.
 */
export function PainelScaledContent({ children, className }: { children: ReactNode; className?: string }) {
  const isMobile = useIsMobile();
  const { zoomPercent, ready } = usePainelContentZoom();
  const scale = isMobile ? 1 : zoomPercent / 100;

  if (!ready || isMobile || scale >= 0.999) {
    return <div className={cn("min-w-0", className)}>{children}</div>;
  }

  return (
    <div className={cn("min-w-0 overflow-x-auto", className)}>
      <div
        className="origin-top-left will-change-transform"
        style={{
          transform: `scale(${scale})`,
          width: `${100 / scale}%`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
