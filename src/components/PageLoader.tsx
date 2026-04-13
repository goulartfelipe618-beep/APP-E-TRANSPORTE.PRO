import { ReactNode } from "react";

/**
 * Wrapper estável da área de conteúdo do painel.
 * O overlay com delay fixo foi removido: bloqueava a thread e causava “flash”/travamento na navegação SPA.
 */
export default function PageLoader({ children }: { children: ReactNode }) {
  return <div className="relative min-h-[60vh] w-full min-w-0">{children}</div>;
}
