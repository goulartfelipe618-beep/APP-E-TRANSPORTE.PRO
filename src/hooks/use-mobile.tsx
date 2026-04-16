import * as React from "react";

/** Viewports at or below this width use the drawer (Sheet) shell — phones and typical tablets in portrait. */
export const SIDEBAR_COMPACT_MAX_PX = 1023;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= SIDEBAR_COMPACT_MAX_PX : false,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${SIDEBAR_COMPACT_MAX_PX}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth <= SIDEBAR_COMPACT_MAX_PX);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth <= SIDEBAR_COMPACT_MAX_PX);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
