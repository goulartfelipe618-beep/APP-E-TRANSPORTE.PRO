import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PLATAFORMA_FERRAMENTAS_DISPONIBILIDADE_QUERY_KEY } from "@/hooks/usePlataformaFerramentasDisponibilidade";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type FlagsState = {
  marketing_menu_liberado: boolean;
};

export default function PlataformaFerramentasBetaSection() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flags, setFlags] = useState<FlagsState>({
    marketing_menu_liberado: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("plataforma_ferramentas_disponibilidade")
        .select("marketing_menu_liberado")
        .eq("id", 1)
        .maybeSingle();
      if (error) {
        toast.error("Não foi possível carregar as flags das ferramentas.");
        return;
      }
      if (data) {
        const row = data as FlagsState;
        setFlags({
          marketing_menu_liberado: !!row.marketing_menu_liberado,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async (patch: Partial<FlagsState>) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("plataforma_ferramentas_disponibilidade")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) {
        toast.error("Erro ao salvar: " + error.message);
        await load();
        return;
      }
      await queryClient.invalidateQueries({ queryKey: PLATAFORMA_FERRAMENTAS_DISPONIBILIDADE_QUERY_KEY });
      toast.success("Preferências atualizadas.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-primary/25">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Liberação de menus e ferramentas
        </CardTitle>
        <CardDescription>
          Controla o que as empresas (Admin User / Motorista Executivo) veem no painel. Enquanto desligado,
          o item correspondente não aparece no menu lateral (e o acesso directo à página fica bloqueado).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <Label htmlFor="flag-marketing" className="text-foreground flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-[#FF6600]" />
                  Categoria Marketing
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Campanhas, E-mail Business, Website, Domínios, Comunidade e Network no menu das empresas.
                </p>
              </div>
              <Switch
                id="flag-marketing"
                disabled={saving}
                checked={flags.marketing_menu_liberado}
                onCheckedChange={(v) => {
                  setFlags((f) => ({ ...f, marketing_menu_liberado: v }));
                  void persist({ marketing_menu_liberado: v });
                }}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
