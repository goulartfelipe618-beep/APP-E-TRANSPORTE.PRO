import { useLayoutEffect, type RefObject } from "react";

/**
 * Ao mudar a página do menu / submenu lateral, repõe o scroll do painel ao topo.
 */
export function useScrollPanelToTop(activePage: string, scrollRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  }, [activePage]);
}
