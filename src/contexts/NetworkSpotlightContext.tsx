import { createContext, useContext, type ReactNode } from "react";

const NetworkSpotlightContext = createContext(false);

export function NetworkSpotlightProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <NetworkSpotlightContext.Provider value={active}>{children}</NetworkSpotlightContext.Provider>
  );
}

export function useNetworkSpotlightActive() {
  return useContext(NetworkSpotlightContext);
}
