import { useEffect, type RefObject } from "react";

/**
 * Reduz a velocidade de scroll (wheel + toque) no elemento.
 * `factor` menor = scroll mais lento (ex.: 0.22 ≈ 4–5× mais devagar que o nativo).
 */
export function useSlowScrollContainer(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  factor = 0.24,
) {
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      if (el.scrollHeight <= el.clientHeight + 2) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= el.clientHeight;
      el.scrollTop += dy * factor;
    };

    let lastTouchY: number | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        lastTouchY = null;
        return;
      }
      lastTouchY = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || lastTouchY === null) return;
      if (el.scrollHeight <= el.clientHeight + 2) return;
      e.preventDefault();
      const y = e.touches[0].clientY;
      const dy = lastTouchY - y;
      lastTouchY = y;
      el.scrollTop += dy * factor;
    };

    const endTouch = () => {
      lastTouchY = null;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", endTouch);
    el.addEventListener("touchcancel", endTouch);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", endTouch);
      el.removeEventListener("touchcancel", endTouch);
    };
  }, [enabled, ref, factor]);
}
