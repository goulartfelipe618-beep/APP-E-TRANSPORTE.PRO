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
import { fetchEvolutionMotoristaQrFromServer, formatPhoneBrDisplay } from "@/lib/evolutionApi";

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

      const { base64, detail } = await fetchEvolutionMotoristaQrFromServer();
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
            A <strong className="text-foreground">linha oficial</strong> da plataforma aparece abaixo para referência. Você
            pode conectar <strong className="text-foreground">apenas um</strong> WhatsApp próprio (instância na Evolution da
            plataforma). Em <strong className="text-foreground">Comunicar</strong>, você escolhe se fala pelo oficial ou
            pelo seu número.
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
        description="Linha oficial da plataforma (sincronizada via n8n / backend). Ao usar Comunicar, você pode enviar mensagens em nome deste canal."
        row={sistema}
        readOnly
        loading={loading}
        busy={false}
        onRefresh={() => void reload()}
        onGerarQr={() => {}}
        evolutionCreds={undefined}
        hideQr
      />

      {own ? (
      <ComunicadorEvolutionSection
        title="Meu comunicador"
        description="Seu único WhatsApp próprio nesta conta. A instância é criada automaticamente no servidor Evolution da plataforma; escaneie o QR para conectar. Em Comunicar, use esta opção para falar pelo seu número."
          row={own}
          readOnly={false}
          loading={loading}
          busy={busy}
          onRefresh={() => void reload()}
          onGerarQr={handleGerarProprio}
          onRemover={handleRemoverProprio}
          showRemover
          evolutionCreds={null}
          hideViteHint
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-2">Conectar meu WhatsApp</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Você pode vincular <strong className="text-foreground">um</strong> número seu. Depois, em Comunicar, escolha
            entre este número e a linha oficial da plataforma.
          </p>
          <Button type="button" className="bg-primary text-primary-foreground" onClick={() => void handleGerarProprio()} disabled={loading || busy}>
            Conectar meu comunicador (QR)
          </Button>
        </div>
      )}
    </div>
  );
}
