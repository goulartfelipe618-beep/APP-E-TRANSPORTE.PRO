import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { renderAvisoTextoComMarcacao } from "@/lib/painelAvisoTexto";
import { avisoFonteClassName } from "@/lib/painelAvisoEstilo";

type AvisoRow = {
  id: string;
  texto: string;
  cor: "verde" | "amarelo" | "vermelho";
  fonte: string;
  incluir_login?: boolean;
};

const COR_CLASS: Record<AvisoRow["cor"], string> = {
  verde: "border-emerald-300 bg-emerald-50 text-emerald-900",
  amarelo: "border-amber-300 bg-amber-50 text-amber-900",
  vermelho: "border-red-300 bg-red-50 text-red-900",
};

export default function LoginAvisosBanner() {
  const [rows, setRows] = useState<AvisoRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("admin_avisos_plataforma")
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) return;
      const all = (data || []) as AvisoRow[];
      setRows(all.filter((r) => r.incluir_login === true));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visiveis = useMemo(() => rows.slice(0, 3), [rows]);

  if (visiveis.length === 0) return null;

  return (
    <div className="space-y-2">
      {visiveis.map((a) => (
        <div
          key={a.id}
          className={cn("rounded-md border px-3 py-2 text-sm shadow-sm", COR_CLASS[a.cor] ?? COR_CLASS.amarelo)}
        >
          <p className={cn("whitespace-pre-wrap", avisoFonteClassName(a.fonte ?? "padrao"))}>
            {renderAvisoTextoComMarcacao(a.texto)}
          </p>
        </div>
      ))}
    </div>
  );
}
