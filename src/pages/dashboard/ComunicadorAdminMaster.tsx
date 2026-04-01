import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ComunicadorEvolutionSection } from "@/components/comunicador/ComunicadorEvolutionSection";
import {
  useComunicadoresEvolution,
  INSTANCE_SISTEMA_DEFAULT,
  instanceNameForUser,
} from "@/hooks/useComunicadoresEvolution";
import { fetchEvolutionQrCode, evolutionEnvConfigured } from "@/lib/evolutionApi";

export default function ComunicadorAdminMasterPage() {
  const { sistema, own, loading, reload } = useComunicadoresEvolution();
  const [busy, setBusy] = useState<"sistema" | "own" | null>(null);

  const patchRow = useCallback(async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase
      .from("comunicadores_evolution")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }, []);

  const handleGerarSistema = useCallback(async () => {
    if (!sistema?.id) {
      toast.error("Registro oficial não encontrado.");
      return;
    }
    setBusy("sistema");
    try {
      const inst = sistema.instance_name?.trim() || INSTANCE_SISTEMA_DEFAULT;
      if (!sistema.instance_name) {
        await patchRow(sistema.id, { instance_name: inst, rotulo: sistema.rotulo || "E-Transporte.pro — Comunicador oficial" });
      }
      if (!evolutionEnvConfigured()) {
        toast.message("Configure VITE_EVOLUTION_API_URL e VITE_EVOLUTION_API_KEY para gerar o QR aqui.", {
          description: `Use a instância "${inst}" no servidor Evolution.`,
        });
        await reload();
        return;
      }
      const { base64, error, detail } = await fetchEvolutionQrCode(inst);
      if (error === "missing_env") {
        toast.error("Evolution não configurada no ambiente.");
        return;
      }
      if (!base64) {
        toast.error("Não foi possível obter o QR Code.", { description: detail });
        return;
      }
      await patchRow(sistema.id, {
        qr_code_base64: base64,
        connection_status: "aguardando_scan",
      });
      toast.success("QR Code gerado. Escaneie com o WhatsApp.");
      await reload();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar comunicador oficial.");
    } finally {
      setBusy(null);
    }
  }, [sistema, patchRow, reload]);

  const handleGerarProprio = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão inválida.");
      return;
    }

    setBusy("own");
    try {
      let row = own;
      if (!row) {
        const inst = instanceNameForUser(user.id);
        const { data: created, error: insErr } = await supabase
          .from("comunicadores_evolution")
          .insert({
            escopo: "usuario",
            user_id: user.id,
            rotulo: "Meu comunicador (Admin Master)",
            instance_name: inst,
            connection_status: "desconectado",
          })
          .select("*")
          .single();
        if (insErr) {
          toast.error("Não foi possível criar o comunicador pessoal.");
          return;
        }
        row = created;
        await reload();
      }

      if (!row?.id) return;
      const inst = row.instance_name?.trim() || instanceNameForUser(user.id);
      if (row.instance_name !== inst) {
        await patchRow(row.id, { instance_name: inst });
      }

      if (!evolutionEnvConfigured()) {
        toast.message("Configure as variáveis Evolution no .env para gerar o QR aqui.", {
          description: `Instância sugerida: ${inst}`,
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
      toast.error("Erro ao gerar QR do comunicador pessoal.");
    } finally {
      setBusy(null);
    }
  }, [own, patchRow, reload]);

  const handleRemoverProprio = useCallback(async () => {
    if (!own?.id) return;
    setBusy("own");
    try {
      const { error } = await supabase.from("comunicadores_evolution").delete().eq("id", own.id);
      if (error) {
        toast.error("Erro ao remover.");
        return;
      }
      toast.success("Comunicador pessoal removido.");
      await reload();
    } finally {
      setBusy(null);
    }
  }, [own, reload]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comunicador</h1>
          <p className="text-muted-foreground">
            Conecte o WhatsApp via Evolution: um comunicador <strong className="text-foreground">oficial</strong> para todos os
            motoristas executivos e, se quiser, um <strong className="text-foreground">pessoal</strong> só para esta conta master.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void reload()} disabled={loading}>
          Atualizar página
        </Button>
      </div>

      <ComunicadorEvolutionSection
        title="Comunicador oficial do sistema"
        description="Este WhatsApp será oferecido a todos os motoristas executivos como opção “E-Transporte.pro”. Gere o QR e conecte o número que a plataforma usará oficialmente."
        row={sistema}
        readOnly={false}
        loading={loading}
        busy={busy === "sistema"}
        onRefresh={() => void reload()}
        onGerarQr={handleGerarSistema}
      />

      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">
          Opcional: segundo comunicador (máx. 2 no painel) — só para este usuário administrador master, independente do oficial.
        </p>
      </div>

      {own ? (
        <ComunicadorEvolutionSection
          title="Meu comunicador (pessoal)"
          description="WhatsApp exclusivo da sua conta master. Não substitui o oficial dos motoristas."
          row={own}
          readOnly={false}
          loading={loading}
          busy={busy === "own"}
          onRefresh={() => void reload()}
          onGerarQr={handleGerarProprio}
          onRemover={handleRemoverProprio}
          showRemover
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-2">Comunicador pessoal (opcional)</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Ainda não existe um segundo comunicador para esta conta. Você pode criar ao gerar o primeiro QR (usa uma instância Evolution separada do oficial).
          </p>
          <Button type="button" className="bg-primary text-primary-foreground" onClick={() => void handleGerarProprio()} disabled={loading || busy === "own"}>
            Criar e gerar QR do meu comunicador
          </Button>
        </div>
      )}
    </div>
  );
}
