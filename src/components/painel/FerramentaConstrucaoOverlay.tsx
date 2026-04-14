import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Escurece e bloqueia cliques no conteúdo enquanto a ferramenta não estiver liberada pelo admin.
 */
export default function FerramentaConstrucaoOverlay({
  disabled,
  children,
  className,
}: {
  disabled: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn("relative isolate rounded-xl", className)}>
      <div className="pointer-events-none select-none opacity-[0.38] grayscale-[0.45] contrast-[0.92] blur-[0.3px]">
        {children}
      </div>
      <div
        className="absolute inset-0 z-10 cursor-not-allowed bg-background/55 backdrop-blur-[1px]"
        aria-hidden
      />
    </div>
  );
}
