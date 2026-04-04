import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { storageKeyAvisoDismiss, type PainelTipo } from "@/lib/painelAvisosPages";
import { Button } from "@/components/ui/button";

type AvisoRow = {
  id: string;
  texto: string;
  cor: "verde" | "amarelo" | "vermelho";
  escopo_global: boolean;
  incluir_motorista: boolean;
  incluir_taxi: boolean;
  paginas_motorista: string[] | null;
  paginas_taxi: string[] | null;
};

const COR_CLASS: Record<AvisoRow["cor"], string> = {
  verde: "bg-emerald-600 text-white border-emerald-700",
  amarelo: "bg-amber-400 text-neutral-900 border-amber-600",
  vermelho: "bg-red-600 text-white border-red-800",
};

function shouldShowAviso(
  row: AvisoRow,
  painel: PainelTipo,
  activePage: string,
): boolean {
  if (painel === "motorista") {
    if (!row.incluir_motorista) return false;
    if (row.escopo_global) return true;
    const pages = row.paginas_motorista || [];
    return pages.includes(activePage);
  }
  if (!row.incluir_taxi) return false;
  if (row.escopo_global) return true;
  const pages = row.paginas_taxi || [];
  return pages.includes(activePage);
}

type Props = {
  painel: PainelTipo;
  activePage: string;
};

export default function PainelAvisoBanner({ painel, activePage }: Props) {
  const [avisos, setAvisos] = useState<AvisoRow[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const loadDismissed = useCallback(() => {
    if (typeof window === "undefined") return new Set<string>();
    const next = new Set<string>();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith("etp_aviso_dismissed:") && localStorage.getItem(k) === "1") {
          next.add(k.replace("etp_aviso_dismissed:", ""));
        }
      }
    } catch {
      /* ignore */
    }
    return next;
  }, []);

  useEffect(() => {
    setDismissed(loadDismissed());
  }, [loadDismissed]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("admin_avisos_plataforma")
        .select(
          "id, texto, cor, escopo_global, incluir_motorista, incluir_taxi, paginas_motorista, paginas_taxi",
        )
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error(error);
        return;
      }
      setAvisos((data || []) as AvisoRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visíveis = useMemo(() => {
    return avisos.filter((a) => {
      if (dismissed.has(a.id)) return false;
      return shouldShowAviso(a, painel, activePage);
    });
  }, [avisos, dismissed, painel, activePage]);

  const dismiss = (id: string) => {
    try {
      localStorage.setItem(storageKeyAvisoDismiss(id), "1");
    } catch {
      /* ignore */
    }
    setDismissed((prev) => new Set(prev).add(id));
  };

  if (visíveis.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 border-b border-border bg-background px-0">
      {visíveis.map((a) => (
        <div
          key={a.id}
          role="status"
          className={cn(
            "flex w-full items-start gap-3 border-b px-4 py-3 text-sm shadow-sm last:border-b-0",
            COR_CLASS[a.cor] ?? COR_CLASS.amarelo,
          )}
        >
          <p className="min-w-0 flex-1 whitespace-pre-wrap leading-snug">{a.texto}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 shrink-0 text-current hover:bg-black/10 dark:hover:bg-white/10",
              a.cor === "amarelo" && "hover:bg-black/15",
            )}
            onClick={() => dismiss(a.id)}
            aria-label="Fechar aviso"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
