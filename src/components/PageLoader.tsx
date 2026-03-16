import { useState, useEffect, ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface PageLoaderProps {
  children: ReactNode;
  /** unique key to trigger reload */
  pageKey: string;
}

export default function PageLoader({ children, pageKey }: PageLoaderProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, [pageKey]);

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
