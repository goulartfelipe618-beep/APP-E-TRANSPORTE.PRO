import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import CabecalhoContratual from "@/components/contratos/CabecalhoContratual";
import ContratoComoPdfPreview from "@/components/contratos/ContratoComoPdfPreview";

const DEFAULT_MODELO = `1. DAS PARTES
1.1. O presente contrato é celebrado entre as partes abaixo qualificadas.
1.2. O CONTRATANTE declara ter conhecimento de todas as condições do serviço contratado.

2. DO SERVIÇO
2.1. O serviço de transfer será realizado conforme trajeto, data e horário especificados neste instrumento.
2.2. O veículo será disponibilizado com motorista profissional habilitado.
2.3. O serviço inclui busca e transporte do grupo até o destino indicado.

3. DO VALOR
3.1. O valor do serviço será aquele especificado neste contrato.
3.2. O pagamento deverá ser efetuado na forma acordada entre as partes.`;

const DEFAULT_POLITICA = `POLÍTICA DE CANCELAMENTO

- Cancelamentos com mais de 72 horas de antecedência: reembolso integral.
- Cancelamentos entre 48 e 72 horas: reembolso de 50%.
- Cancelamentos com menos de 48 horas: sem reembolso.
- No-show (não comparecimento): sem reembolso.

A empresa reserva-se o direito de cancelar o serviço em casos de força maior, oferecendo reagendamento ou reembolso integral.`;

const DEFAULT_CLAUSULAS = `CLÁUSULAS ADICIONAIS

8.1. Este contrato é regido pelas leis da República Federativa do Brasil.
8.2. Fica eleito o foro da comarca local para dirimir quaisquer dúvidas oriundas deste contrato.
8.3. As partes declaram ter lido e concordado com todos os termos deste contrato.
8.4. Alterações de trajeto durante o serviço poderão acarretar cobrança adicional.
8.5. É proibido o consumo de bebidas alcoólicas e alimentos que possam danificar o veículo.`;

export default function TransferContratoPage() {
  const [modelo, setModelo] = useState(DEFAULT_MODELO);
  const [politica, setPolitica] = useState(DEFAULT_POLITICA);
  const [clausulas, setClausulas] = useState(DEFAULT_CLAUSULAS);
  const [saving, setSaving] = useState(false);
  const [persistingToggle, setPersistingToggle] = useState(false);
  const [incluirNoPdfConfirmacao, setIncluirNoPdfConfirmacao] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const fetchContrato = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("contratos").select("*").eq("user_id", user.id).eq("tipo", "transfer").maybeSingle();
    if (data) {
      setModelo(data.modelo_contrato || DEFAULT_MODELO);
      setPolitica(data.politica_cancelamento || DEFAULT_POLITICA);
      setClausulas(data.clausulas_adicionais || DEFAULT_CLAUSULAS);
      setIncluirNoPdfConfirmacao(data.incluir_no_pdf_confirmacao !== false);
    } else {
      setIncluirNoPdfConfirmacao(true);
    }
    setLoaded(true);
  }, []);

  useEffect(() => { fetchContrato(); }, [fetchContrato]);

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não logado"); setSaving(false); return; }

    const { error } = await supabase.from("contratos").upsert({
      user_id: user.id,
      tipo: "transfer",
      modelo_contrato: modelo,
      politica_cancelamento: politica,
      clausulas_adicionais: clausulas,
      incluir_no_pdf_confirmacao: incluirNoPdfConfirmacao,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,tipo" });

    setSaving(false);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else toast.success("Contrato salvo com sucesso!");
  };

  const persistIncluirNoPdf = async (next: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Não logado");
      return;
    }
    const prev = incluirNoPdfConfirmacao;
    setIncluirNoPdfConfirmacao(next);
    setPersistingToggle(true);
    const { error } = await supabase.from("contratos").upsert(
      {
        user_id: user.id,
        tipo: "transfer",
        modelo_contrato: modelo,
        politica_cancelamento: politica,
        clausulas_adicionais: clausulas,
        incluir_no_pdf_confirmacao: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,tipo" },
    );
    setPersistingToggle(false);
    if (error) {
      setIncluirNoPdfConfirmacao(prev);
      toast.error("Erro ao atualizar: " + error.message);
    } else {
      toast.success(next ? "Contrato incluído no PDF de confirmação." : "Contrato removido do PDF de confirmação.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contrato de Transfer</h1>
          <p className="text-muted-foreground">
            O conteúdo abaixo é o mesmo bloco de contrato que entra no PDF de confirmação (página(s) após a confirmação, mesmo arquivo A4). Edite os textos na seção no final da página.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || !loaded} className="shrink-0">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Contrato
        </Button>
      </div>

      <div
        className={cn(
          "flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between",
          !incluirNoPdfConfirmacao && "border-muted-foreground/30 bg-muted/20",
        )}
      >
        <div className="space-y-1">
          <Label htmlFor="transfer-contrato-pdf-toggle" className="text-base font-semibold text-foreground">
            Contrato no PDF de confirmação da reserva
          </Label>
          <p className="text-sm text-muted-foreground">
            Quando ativado, o contrato entra no mesmo ficheiro da confirmação (download e envio pelo Comunicar). Quando desativado, o PDF contém apenas a confirmação.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          {persistingToggle ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden /> : null}
          <Switch
            id="transfer-contrato-pdf-toggle"
            checked={incluirNoPdfConfirmacao}
            onCheckedChange={(v) => void persistIncluirNoPdf(Boolean(v))}
            disabled={!loaded || persistingToggle}
          />
        </div>
      </div>

      <CabecalhoContratual />

      <ContratoComoPdfPreview modelo={modelo} politica={politica} clausulas={clausulas} />

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-1">Editar textos do contrato</h3>
        <p className="text-sm text-muted-foreground mb-4">Alterações refletem imediatamente na pré-visualização e no PDF ao gerar a confirmação.</p>
        <h4 className="text-sm font-medium text-foreground mb-2">Modelo de Contrato</h4>
        <textarea
          className="w-full h-48 bg-muted rounded-lg p-4 text-sm text-foreground font-mono resize-y border-0 focus:outline-none focus:ring-2 focus:ring-primary/20"
          value={modelo}
          onChange={(e) => setModelo(e.target.value)}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h4 className="text-sm font-medium text-foreground mb-1">Política de Cancelamento</h4>
        <p className="text-sm text-muted-foreground mb-3">Regras para cancelamento e reembolso do serviço</p>
        <textarea
          className="w-full h-40 bg-muted rounded-lg p-4 text-sm text-foreground font-mono resize-y border-0 focus:outline-none focus:ring-2 focus:ring-primary/20"
          value={politica}
          onChange={(e) => setPolitica(e.target.value)}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h4 className="text-sm font-medium text-foreground mb-1">Cláusulas Adicionais</h4>
        <p className="text-sm text-muted-foreground mb-3">Disposições finais e informações complementares</p>
        <textarea
          className="w-full h-40 bg-muted rounded-lg p-4 text-sm text-foreground font-mono resize-y border-0 focus:outline-none focus:ring-2 focus:ring-primary/20"
          value={clausulas}
          onChange={(e) => setClausulas(e.target.value)}
        />
      </div>
    </div>
  );
}
