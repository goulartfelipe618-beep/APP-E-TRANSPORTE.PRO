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
    return <div className={cn("min-w-0 w-full max-w-full", className)}>{children}</div>;
  }

  // O filho usa width > 100 % + scale() para caber visualmente na coluna; isso alarga a caixa de layout.
  // overflow-x-auto aqui gerava scroll horizontal “fantasma” (área vazia). Escondemos o excesso de layout;
  // tabelas largas mantêm scroll nos respetivos wrappers (overflow-x-auto) dentro da página.
  return (
    <div className={cn("min-w-0 w-full max-w-full overflow-x-hidden", className)}>
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
