import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ComunicadorEvolutionSection } from "@/components/comunicador/ComunicadorEvolutionSection";
import { ComunicadorOficialConfigForm, type OficialFormValues } from "@/components/comunicador/ComunicadorOficialConfigForm";
import {
  useComunicadoresEvolution,
  INSTANCE_SISTEMA_DEFAULT,
  instanceNameForUser,
} from "@/hooks/useComunicadoresEvolution";
import {
  fetchEvolutionQrCode,
  fetchEvolutionConnectionInfo,
  formatPhoneBrDisplay,
  resolveEvolutionCreds,
  type EvolutionCreds,
} from "@/lib/evolutionApi";

const emptyForm = (): OficialFormValues => ({
  api_url: "",
  api_key: "",
  instance_name: INSTANCE_SISTEMA_DEFAULT,
  nome_dispositivo: "",
});

export default function ComunicadorAdminMasterPage() {
  const { sistema, own, loading, reload } = useComunicadoresEvolution();
  const [busy, setBusy] = useState<"sistema" | "own" | null>(null);
  const [oficialForm, setOficialForm] = useState<OficialFormValues>(emptyForm);

  useEffect(() => {
    if (!sistema) return;
    setOficialForm((f) => ({
      ...f,
      instance_name: sistema.instance_name?.trim() || INSTANCE_SISTEMA_DEFAULT,
      nome_dispositivo: sistema.nome_dispositivo ?? "",
    }));
  }, [sistema?.id, sistema?.instance_name, sistema?.nome_dispositivo]);

  useEffect(() => {
    if (!sistema?.id) return;
    void (async () => {
      const { data } = await supabase
        .from("comunicador_evolution_credenciais")
        .select("api_url, api_key")
        .eq("comunicador_id", sistema.id)
        .maybeSingle();
      if (data) {
        setOficialForm((f) => ({
          ...f,
          api_url: data.api_url ?? "",
          api_key: data.api_key ?? "",
        }));
      }
    })();
  }, [sistema?.id]);

  const oficialCreds: EvolutionCreds | null = resolveEvolutionCreds({
    baseUrl: oficialForm.api_url,
    apiKey: oficialForm.api_key,
  });

  const patchRow = useCallback(async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase
      .from("comunicadores_evolution")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }, []);

  const salvarOficial = useCallback(async () => {
    if (!sistema?.id) {
      toast.error("Registro oficial não encontrado.");
      return;
    }
    const url = oficialForm.api_url.trim();
    const key = oficialForm.api_key.trim();
    const inst = oficialForm.instance_name.trim() || INSTANCE_SISTEMA_DEFAULT;
    if (!url || !key) {
      toast.error("Preencha URL e chave da API.");
      return;
    }

    setBusy("sistema");
    try {
      await patchRow(sistema.id, {
        instance_name: inst,
        nome_dispositivo: oficialForm.nome_dispositivo.trim() || null,
        rotulo: sistema.rotulo || "E-Transporte.pro — Comunicador oficial",
      });

      const { data: existing } = await supabase
        .from("comunicador_evolution_credenciais")
        .select("id")
        .eq("comunicador_id", sistema.id)
        .maybeSingle();

      const credPayload = {
        api_url: url,
        api_key: key,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error: uErr } = await supabase
          .from("comunicador_evolution_credenciais")
          .update(credPayload)
          .eq("comunicador_id", sistema.id);
        if (uErr) throw uErr;
      } else {
        const { error: iErr } = await supabase.from("comunicador_evolution_credenciais").insert({
          comunicador_id: sistema.id,
          ...credPayload,
        });
        if (iErr) throw iErr;
      }

      const creds: EvolutionCreds = { baseUrl: url, apiKey: key };
      const { phone, state } = await fetchEvolutionConnectionInfo(inst, creds);
      const connected = Boolean(phone) || state === "open";
      await patchRow(sistema.id, {
        telefone_conectado: phone ?? sistema.telefone_conectado,
        connection_status: connected ? "conectado" : state || "desconectado",
      });

      if (phone) {
        toast.success(`Número oficial disponível para todos: ${formatPhoneBrDisplay(phone)}`);
      } else {
        toast.success("Configuração salva. Gere o QR abaixo para conectar o WhatsApp; depois salve novamente para atualizar o número.");
      }
      await reload();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar configuração do comunicador oficial.");
    } finally {
      setBusy(null);
    }
  }, [sistema, oficialForm, patchRow, reload]);

  const handleGerarSistema = useCallback(async () => {
    if (!sistema?.id) {
      toast.error("Registro oficial não encontrado.");
      return;
    }
    const creds = resolveEvolutionCreds({
      baseUrl: oficialForm.api_url,
      apiKey: oficialForm.api_key,
    });
    if (!creds) {
      toast.error("Preencha e salve URL e chave da API na configuração acima.");
      return;
    }
    setBusy("sistema");
    try {
      const inst = oficialForm.instance_name.trim() || sistema.instance_name?.trim() || INSTANCE_SISTEMA_DEFAULT;
      await patchRow(sistema.id, { instance_name: inst });

      const { base64, error, detail } = await fetchEvolutionQrCode(inst, creds);
      if (error === "missing_env") {
        toast.error("Credenciais inválidas.");
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
      toast.success("QR Code gerado. Escaneie com o WhatsApp; em seguida use “Salvar e publicar” para atualizar o número.");
      await reload();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar QR do comunicador oficial.");
    } finally {
      setBusy(null);
    }
  }, [sistema, oficialForm.api_url, oficialForm.api_key, oficialForm.instance_name, patchRow, reload]);

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

      const creds = resolveEvolutionCreds(null);
      if (!creds) {
        toast.message("Para o comunicador pessoal, configure VITE_EVOLUTION_API_URL e VITE_EVOLUTION_API_KEY no ambiente.", {
          description: `Instância: ${inst}`,
        });
        return;
      }

      const { base64, detail } = await fetchEvolutionQrCode(inst, creds);
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

  const setField = useCallback((field: keyof OficialFormValues, value: string) => {
    setOficialForm((f) => ({ ...f, [field]: value }));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comunicador</h1>
          <p className="text-muted-foreground">
            Defina a Evolution do <strong className="text-foreground">comunicador oficial</strong> abaixo; ao salvar, o número passa a aparecer para todos os motoristas executivos. Opcionalmente, use um segundo comunicador só para esta conta master.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void reload()} disabled={loading}>
          Atualizar página
        </Button>
      </div>

      <ComunicadorOficialConfigForm
        values={oficialForm}
        onChange={setField}
        onSubmit={salvarOficial}
        saving={busy === "sistema"}
        disabled={loading}
      />

      <ComunicadorEvolutionSection
        title="Comunicador oficial do sistema"
        description="Gere o QR com as credenciais salvas acima. Depois que o WhatsApp conectar, clique em “Salvar e publicar” para sincronizar o número exibido aos motoristas."
        row={sistema}
        readOnly={false}
        loading={loading}
        busy={busy === "sistema"}
        onRefresh={() => void reload()}
        onGerarQr={handleGerarSistema}
        evolutionCreds={oficialCreds}
      />

      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">
          Opcional: segundo comunicador (máx. 2 no painel) — só para este usuário administrador master. Usa variáveis VITE_EVOLUTION_* no ambiente, se configuradas.
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
          evolutionCreds={null}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground mb-2">Comunicador pessoal (opcional)</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Ainda não existe um segundo comunicador para esta conta.
          </p>
          <Button type="button" className="bg-primary text-primary-foreground" onClick={() => void handleGerarProprio()} disabled={loading || busy === "own"}>
            Criar e gerar QR do meu comunicador
          </Button>
        </div>
      )}
    </div>
  );
}
