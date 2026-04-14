import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePainelMotoristaEvolutionAtivo } from "@/hooks/usePainelMotoristaEvolutionAtivo";
import { ComunicadorEvolutionSection } from "@/components/comunicador/ComunicadorEvolutionSection";
import {
  useComunicadoresEvolution,
  instanceNameForUser,
} from "@/hooks/useComunicadoresEvolution";
import {
  fetchEvolutionMotoristaQrFromServer,
  fetchEvolutionMotoristaSyncFromServer,
  fetchEvolutionMotoristaDeleteFromServer,
  formatPhoneBrDisplay,
} from "@/lib/evolutionApi";
import { Info } from "lucide-react";

export default function ComunicadorMotoristaExecutivoPage() {
  const { painelMotoristaEvolutionAtivo, ready: painelComunicadorReady } = usePainelMotoristaEvolutionAtivo();
  const { sistema, own, loading, reload } = useComunicadoresEvolution();
  const [busy, setBusy] = useState(false);

  const patchRow = useCallback(async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase
      .from("comunicadores_evolution")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }, []);

  const applySyncToRow = useCallback(
    async (rowId: string) => {
      const sync = await fetchEvolutionMotoristaSyncFromServer();
      if (sync.detail && !sync.phone && !sync.profilePicUrl && !sync.profileName) {
        return;
      }
      if (sync.phone) {
        await patchRow(rowId, {
          telefone_conectado: sync.phone,
          connection_status: "conectado",
          qr_code_base64: null,
          foto_perfil_url: sync.profilePicUrl ?? null,
          nome_dispositivo: sync.profileName?.trim() || null,
        });
        await reload();
        return;
      }
      if (sync.profilePicUrl || sync.profileName) {
        await patchRow(rowId, {
          foto_perfil_url: sync.profilePicUrl ?? null,
          nome_dispositivo: sync.profileName?.trim() || null,
        });
        await reload();
      }
    },
    [patchRow, reload],
  );

  useEffect(() => {
    if (!painelComunicadorReady || !painelMotoristaEvolutionAtivo) return;
    if (!own?.id) return;
    const needPoll =
      own.connection_status === "aguardando_scan" ||
      (Boolean(own.qr_code_base64) && !own.telefone_conectado?.trim());

    if (!needPoll) return;

    let cancelled = false;
    const id = setInterval(() => {
      if (cancelled) return;
      void (async () => {
        try {
          await applySyncToRow(own.id);
        } catch (e) {
          console.error(e);
        }
      })();
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [
    painelComunicadorReady,
    painelMotoristaEvolutionAtivo,
    own?.id,
    own?.connection_status,
    own?.qr_code_base64,
    own?.telefone_conectado,
    applySyncToRow,
  ]);

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
      toast.success("QR Code gerado. Escaneie para conectar.");
      await reload();
      setTimeout(() => {
        void applySyncToRow(row.id);
      }, 2000);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar QR.");
    } finally {
      setBusy(false);
    }
  }, [own, patchRow, reload, applySyncToRow]);

  const handleRemoverProprio = useCallback(async () => {
    if (!own?.id) return;
    setBusy(true);
    try {
      const evo = await fetchEvolutionMotoristaDeleteFromServer();
      if (!evo.ok) {
        const d = evo.detail || "";
        const probablyMissing = /404|not found|não exist|does not exist/i.test(d);
        if (!probablyMissing) {
          toast.error("Não foi possível excluir na Evolution.", { description: d });
          return;
        }
      }
      const { error } = await supabase.from("comunicadores_evolution").delete().eq("id", own.id);
      if (error) {
        toast.error("Erro ao remover registro.", { description: error.message });
        return;
      }
      toast.success("Comunicador removido.");
      await reload();
    } finally {
      setBusy(false);
    }
  }, [own, reload]);

  const refreshOwn = useCallback(async () => {
    await reload();
    if (own?.id && (own.connection_status === "aguardando_scan" || (own.qr_code_base64 && !own.telefone_conectado))) {
      try {
        await applySyncToRow(own.id);
      } catch {
        /* ignore */
      }
    }
  }, [reload, own, applySyncToRow]);

  if (painelComunicadorReady && !painelMotoristaEvolutionAtivo) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comunicador</h1>
          <p className="text-muted-foreground">Integração Evolution (WhatsApp)</p>
        </div>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Funcionalidade indisponível</AlertTitle>
          <AlertDescription className="text-sm">
            O administrador desativou o Comunicador Evolution no painel dos motoristas. Quando for reativado, o menu
            voltará a aparecer em Configurações.
          </AlertDescription>
        </Alert>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">O que foi desligado?</CardTitle>
            <CardDescription>
              A ligação do WhatsApp próprio (QR Code na Evolution da plataforma) e a referência à linha oficial deixam de ser
              oferecidas neste painel até nova liberação.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

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
          <CardContent className="space-y-2 pt-6 pb-6 text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Número oficial da plataforma</p>
            {sistema.nome_dispositivo ? (
              <p className="text-base font-medium text-foreground">{sistema.nome_dispositivo}</p>
            ) : null}
            <p className="text-3xl font-bold font-mono tracking-tight text-foreground break-all sm:text-4xl">
              {formatPhoneBrDisplay(sistema.telefone_conectado)}
            </p>
            <p className="mx-auto max-w-md pt-2 text-xs text-muted-foreground">
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
          description="Conecte seu WhatsApp pelo QR. Após escanear, foto e número são sincronizados automaticamente."
          row={own}
          readOnly={false}
          loading={loading}
          busy={busy}
          onRefresh={() => void refreshOwn()}
          onGerarQr={handleGerarProprio}
          onRemover={handleRemoverProprio}
          showRemover
          evolutionCreds={null}
          hideViteHint
          motoristaOwn
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-2 font-semibold text-foreground">Conectar meu WhatsApp</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Você pode vincular <strong className="text-foreground">um</strong> número seu. Depois, em Comunicar, escolha
            entre este número e a linha oficial da plataforma.
          </p>
          <Button
            type="button"
            className="bg-primary text-primary-foreground"
            onClick={() => void handleGerarProprio()}
            disabled={loading || busy}
          >
            Conectar meu comunicador (QR)
          </Button>
        </div>
      )}
    </div>
  );
}
