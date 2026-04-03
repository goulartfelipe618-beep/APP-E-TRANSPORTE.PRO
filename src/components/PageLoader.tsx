import { useState, useEffect, ReactNode } from "react";
import { Loader2 } from "lucide-react";

/** Painel Motorista (frota): menus com `SlideCarousel` — únicos que devem exibir o overlay de carregamento. */
export const FROTA_SLIDE_LOADER_PAGES = [
  "home",
  "transfer/geolocalizacao",
  "google",
  "email-business",
  "website",
  "disparador",
  "mentoria",
  "empty-legs",
  "comunidade",
] as const;

interface PageLoaderProps {
  children: ReactNode;
  /** unique key to trigger reload */
  pageKey: string;
  /**
   * Só exibe o overlay "E-transporte.pro" quando `pageKey` está nesta lista (menus com slides).
   * No painel táxi, use por exemplo `["home"]`.
   */
  showLoaderOnPages?: readonly string[];
}

export default function PageLoader({ children, pageKey, showLoaderOnPages }: PageLoaderProps) {
  const shouldShowLoader = Boolean(showLoaderOnPages?.includes(pageKey));

  const [loading, setLoading] = useState(shouldShowLoader);

  useEffect(() => {
    if (!shouldShowLoader) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, [pageKey, shouldShowLoader]);

  return (
    <div className="relative min-h-[60vh]">
      {/* Children always mounted (hidden while loading) so data fetches in parallel */}
      <div className={loading ? "invisible absolute inset-0" : ""}>
        {children}
      </div>
      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-lg font-bold text-foreground tracking-wide">E-transporte.pro</p>
        </div>
      )}
    </div>
  );
}
