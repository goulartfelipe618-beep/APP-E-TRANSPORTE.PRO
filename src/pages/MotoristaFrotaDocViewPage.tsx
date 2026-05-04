import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { FileWarning } from "lucide-react";

/**
 * Abre documentos da frota no domínio da app (barra de endereço), com o ficheiro
 * servido em iframe a partir da Edge Function (JWT curto em query).
 */
export default function MotoristaFrotaDocViewPage() {
  const [searchParams] = useSearchParams();
  const t = searchParams.get("t")?.trim() ?? "";

  const src = useMemo(() => {
    const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
    if (!base || !t) return "";
    return `${base.replace(/\/$/, "")}/functions/v1/motorista-frota-doc-link?t=${encodeURIComponent(t)}`;
  }, [t]);

  if (!t || !src) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <FileWarning className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Ligação inválida ou expirada. Gere novamente a partir do painel.</p>
      </div>
    );
  }

  return (
    <div className="min-h-svh w-full bg-background">
      <iframe title="Documento" src={src} className="h-svh w-full border-0" />
    </div>
  );
}
