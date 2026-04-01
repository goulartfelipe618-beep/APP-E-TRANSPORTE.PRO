import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ComunicadorEvolutionSection } from "@/components/comunicador/ComunicadorEvolutionSection";
import {
  useComunicadoresEvolution,
  instanceNameForUser,
} from "@/hooks/useComunicadoresEvolution";
import { fetchEvolutionQrCode, evolutionEnvConfigured, formatPhoneBrDisplay } from "@/lib/evolutionApi";

export default function ComunicadorMotoristaExecutivoPage() {
  const { sistema, own, loading, reload } = useComunicadoresEvolution();
  const [busy, setBusy] = useState(false);

  const patchRow = useCallback(async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase
      .from("comunicadores_evolution")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }, []);

  const handleGerarProprio = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão inválida.");
      return;
    }

    setBusy(true);
    try {
      let row = own;
      if (!row) {
        const inst = instanceNameForUser(user.id);
        const { data: created, error: insErr } = await supabase
          .from("comunicadores_evolution")
          .insert({
            escopo: "usuario",
            user_id: user.id,
            rotulo: "Meu WhatsApp (comunicador próprio)",
            instance_name: inst,
            connection_status: "desconectado",
          })
          .select("*")
          .single();
        if (insErr) {
          toast.error("Não foi possível criar o comunicador.");
          return;
        }
        row = created;
        await reload();
      }

      if (!row?.id) return;
      const inst = row.instance_name?.trim() || instanceNameForUser(user.id);

      if (!evolutionEnvConfigured(null)) {
        toast.message("Configure VITE_EVOLUTION_API_URL e VITE_EVOLUTION_API_KEY para gerar o QR nesta tela.", {
          description: `Instância: ${inst}`,
        });
        return;
      }

      const { base64, detail } = await fetchEvolutionQrCode(inst);
      if (!base64) {
        toast.error("Não foi possível obter o QR Code.", { description: detail });
        return;
      }
      await patchRow(row.id, {
        qr_code_base64: base64,
        connection_status: "aguardando_scan",
      });
      toast.success("QR Code gerado.");
      await reload();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar QR.");
    } finally {
      setBusy(false);
    }
  }, [own, patchRow, reload]);

  const handleRemoverProprio = useCallback(async () => {
    if (!own?.id) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("comunicadores_evolution").delete().eq("id", own.id);
      if (error) {
        toast.error("Erro ao remover.");
        return;
      }
      toast.success("Comunicador próprio removido. Você continua com o oficial do sistema.");
      await reload();
    } finally {
      setBusy(false);
    }
  }, [own, reload]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comunicador</h1>
          <p className="text-muted-foreground">
            Você tem no <strong className="text-foreground">máximo dois</strong> comunicadores: o{" "}
            <strong className="text-foreground">oficial E-Transporte.pro</strong> (sempre disponível) e, se quiser,{" "}
            <strong className="text-foreground">o seu próprio</strong> WhatsApp.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void reload()} disabled={loading}>
          Atualizar
        </Button>
      </div>

      {sistema?.telefone_conectado ? (
        <Card className="border-primary/40 bg-primary/5 shadow-sm">
          <CardContent className="pt-6 pb-6 text-center space-y-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Número oficial da plataforma</p>
            {sistema.nome_dispositivo ? (
              <p className="text-base text-foreground font-medium">{sistema.nome_dispositivo}</p>
            ) : null}
            <p className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-foreground break-all">
              {formatPhoneBrDisplay(sistema.telefone_conectado)}
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto pt-2">
              Use este WhatsApp para comunicação oficial com clientes quando a política da sua operação assim exigir.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <ComunicadorEvolutionSection
        title="Comunicador oficial E-Transporte.pro"
        description="Conectado pelo administrador master. Use este canal quando quiser falar com clientes pela linha oficial da plataforma."
        row={sistema}
        readOnly
        loading={loading}
        busy={false}
        onRefresh={() => void reload()}
        onGerarQr={() => {}}
        evolutionCreds={undefined}
      />

      {own ? (
        <ComunicadorEvolutionSection
          title="Meu comunicador"
          description="Seu WhatsApp próprio, separado do oficial. Máximo de um comunicador pessoal por conta."
          row={own}
          readOnly={false}
          loading={loading}
          busy={busy}
          onRefresh={() => void reload()}
          onGerarQr={handleGerarProprio}
          onRemover={handleRemoverProprio}
          showRemover
          evolutionCreds={null}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-2">Comunicador próprio (opcional)</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Adicione até um WhatsApp seu (segunda opção). O primeiro comunicador continua sendo sempre o oficial acima.
          </p>
          <Button type="button" className="bg-primary text-primary-foreground" onClick={() => void handleGerarProprio()} disabled={loading || busy}>
            Adicionar meu comunicador e gerar QR
          </Button>
        </div>
      )}
    </div>
  );
}
