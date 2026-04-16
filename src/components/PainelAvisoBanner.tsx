import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { type PainelTipo } from "@/lib/painelAvisosPages";
import { avisoFonteClassName } from "@/lib/painelAvisoEstilo";
import { renderAvisoTextoComMarcacao } from "@/lib/painelAvisoTexto";
import {
  applyFirstDismiss,
  applySecondDismiss,
  getAvisoDisplayMode,
  loadUserAvisoMap,
  type StoredAvisoState,
} from "@/lib/painelAvisoStorage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type AvisoRow = {
  id: string;
  texto: string;
  cor: "verde" | "amarelo" | "vermelho";
  escopo_global: boolean;
  incluir_motorista: boolean;
  incluir_taxi: boolean;
  paginas_motorista: string[] | null;
  paginas_taxi: string[] | null;
  fonte: string;
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

const TICK_MS = 60_000;

export default function PainelAvisoBanner({ painel, activePage }: Props) {
  const [avisos, setAvisos] = useState<AvisoRow[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [stateMap, setStateMap] = useState<Record<string, StoredAvisoState>>({});
  const [now, setNow] = useState(() => Date.now());
  const [neverAgain, setNeverAgain] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setStateMap({});
      return;
    }
    setStateMap(loadUserAvisoMap(userId));
  }, [userId]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("admin_avisos_plataforma")
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error(error);
        return;
      }
      const rows = (data || []) as AvisoRow[];
      setAvisos(
        rows.map((r) => ({
          ...r,
          fonte: r.fonte ?? "padrao",
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visíveis = useMemo(() => {
    if (!authReady || !userId) return [];
    return avisos.filter((a) => {
      if (!shouldShowAviso(a, painel, activePage)) return false;
      return getAvisoDisplayMode(a.id, stateMap, now) !== "hidden";
    });
  }, [avisos, painel, activePage, stateMap, now, userId, authReady]);

  const setNeverAgainFor = useCallback((avisoId: string, checked: boolean) => {
    setNeverAgain((prev) => ({ ...prev, [avisoId]: checked }));
  }, []);

  const fechar = useCallback(
    (avisoId: string) => {
      if (!userId) return;
      const t = Date.now();
      setNow(t);
      const marcarNuncaMais = neverAgain[avisoId] === true;
      setStateMap((prev) => {
        const mode = getAvisoDisplayMode(avisoId, prev, t);
        if (mode === "first") return applyFirstDismiss(userId, avisoId, prev, t);
        if (mode === "second") return applySecondDismiss(userId, avisoId, marcarNuncaMais, prev, t);
        return prev;
      });
      setNeverAgain((prev) => ({ ...prev, [avisoId]: false }));
    },
    [userId, neverAgain],
  );

  if (!authReady || visíveis.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 border-b border-border bg-background px-0">
      {visíveis.map((a) => {
        const mode = getAvisoDisplayMode(a.id, stateMap, now);
        const showNeverAgain = mode === "second";
        const checkboxId = `aviso-never-${a.id}`;

        return (
          <div
            key={a.id}
            role="status"
            className={cn(
              "flex w-full min-w-0 flex-col gap-3 border-b px-3 py-3 text-sm shadow-sm last:border-b-0 sm:flex-row sm:flex-wrap sm:items-start sm:px-4",
              COR_CLASS[a.cor] ?? COR_CLASS.amarelo,
            )}
          >
            <p
              className={cn(
                "min-w-0 w-full whitespace-pre-wrap break-words leading-snug sm:flex-1 sm:min-h-[2rem]",
                avisoFonteClassName(a.fonte),
              )}
            >
              {renderAvisoTextoComMarcacao(a.texto)}
            </p>
            <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:ml-auto sm:w-auto sm:justify-start sm:gap-3">
              {showNeverAgain ? (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={checkboxId}
                    checked={neverAgain[a.id] === true}
                    onCheckedChange={(v) => setNeverAgainFor(a.id, v === true)}
                    className={cn(
                      a.cor === "amarelo" &&
                        "border-neutral-900/55 data-[state=checked]:bg-neutral-900 data-[state=checked]:text-amber-300",
                      a.cor === "verde" &&
                        "border-white/60 data-[state=checked]:bg-white data-[state=checked]:text-emerald-700",
                      a.cor === "vermelho" &&
                        "border-white/60 data-[state=checked]:bg-white data-[state=checked]:text-red-700",
                    )}
                  />
                  <Label htmlFor={checkboxId} className="cursor-pointer text-sm font-normal leading-tight text-current">
                    Não mostrar novamente
                  </Label>
                </div>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 shrink-0 text-current hover:bg-black/10 dark:hover:bg-white/10",
                  a.cor === "amarelo" && "hover:bg-black/15",
                )}
                onClick={() => fechar(a.id)}
                aria-label="Fechar aviso"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
