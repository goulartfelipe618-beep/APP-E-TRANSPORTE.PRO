import { createContext, useCallback, useContext, useState, ReactNode } from "react";

interface ActivePageContextType {
  activePage: string;
  setActivePage: (page: string) => void;
}

const ActivePageContext = createContext<ActivePageContextType>({
  activePage: "",
  setActivePage: () => {},
});

function readStoredPage(storageKey: string | undefined, fallback: string): string {
  if (!storageKey || typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (raw && raw.length > 0 && raw.length < 240) return raw;
  } catch {
    /* sessionStorage indisponível */
  }
  return fallback;
}

export function ActivePageProvider({
  defaultPage,
  storageKey,
  children,
}: {
  defaultPage: string;
  /** Se definido, persiste a última página nesta sessão do navegador (troca de aba / minimizar). */
  storageKey?: string;
  children: ReactNode;
}) {
  const [activePage, setActivePageState] = useState(() => readStoredPage(storageKey, defaultPage));

  const setActivePage = useCallback(
    (page: string) => {
      setActivePageState(page);
      if (storageKey && typeof window !== "undefined") {
        try {
          sessionStorage.setItem(storageKey, page);
        } catch {
          /* ignore */
        }
      }
    },
    [storageKey],
  );

  return (
    <ActivePageContext.Provider value={{ activePage, setActivePage }}>
      {children}
    </ActivePageContext.Provider>
  );
}

export const useActivePage = () => useContext(ActivePageContext);
