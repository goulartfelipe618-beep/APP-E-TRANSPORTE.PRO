import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PLATAFORMA_FERRAMENTAS_DISPONIBILIDADE_QUERY_KEY } from "@/hooks/usePlataformaFerramentasDisponibilidade";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function PlataformaFerramentasBetaSection() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disparadorOk, setDisparadorOk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("plataforma_ferramentas_disponibilidade")
        .select("disparador_consumo_liberado")
        .eq("id", 1)
        .maybeSingle();
      if (error) {
        toast.error("Não foi possível carregar as flags das ferramentas.");
        return;
      }
      if (data) {
        const row = data as { disparador_consumo_liberado: boolean };
        setDisparadorOk(!!row.disparador_consumo_liberado);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async (patch: { disparador_consumo_liberado?: boolean }) => {
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
          Ferramentas BETA — liberação de uso
        </CardTitle>
        <CardDescription>
          Enquanto desligado, motoristas executivos veem aviso fixo e não conseguem usar o Disparador no painel.
          Ative quando a ferramenta estiver pronta para consumo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <Label htmlFor="flag-disparador" className="text-foreground">
                Disparador de mensagens
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">Permite o botão de acesso e conteúdo utilizável na página Disparador.</p>
            </div>
            <Switch
              id="flag-disparador"
              disabled={saving}
              checked={disparadorOk}
              onCheckedChange={(v) => {
                setDisparadorOk(v);
                void persist({ disparador_consumo_liberado: v });
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
