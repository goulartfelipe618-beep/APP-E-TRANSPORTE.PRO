import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CabecalhoContratual from "@/components/contratos/CabecalhoContratual";

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
  const [loaded, setLoaded] = useState(false);

  const fetchContrato = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("contratos").select("*").eq("user_id", user.id).eq("tipo", "transfer").maybeSingle();
    if (data) {
      setModelo(data.modelo_contrato || DEFAULT_MODELO);
      setPolitica(data.politica_cancelamento || DEFAULT_POLITICA);
      setClausulas(data.clausulas_adicionais || DEFAULT_CLAUSULAS);
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
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,tipo" });

    setSaving(false);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else toast.success("Contrato salvo com sucesso!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contrato de Transfer</h1>
          <p className="text-muted-foreground">Modelo de contrato para serviços de transfer. Este contrato aparecerá no PDF de confirmação de reserva.</p>
        </div>
        <Button onClick={handleSave} disabled={saving || !loaded}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Contrato
        </Button>
      </div>

      <CabecalhoContratual />

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3">Modelo de Contrato</h3>
        <textarea
          className="w-full h-48 bg-muted rounded-lg p-4 text-sm text-foreground font-mono resize-y border-0 focus:outline-none focus:ring-2 focus:ring-primary/20"
          value={modelo}
          onChange={(e) => setModelo(e.target.value)}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-1">Política de Cancelamento</h3>
        <p className="text-sm text-muted-foreground mb-3">Regras para cancelamento e reembolso do serviço</p>
        <textarea
          className="w-full h-40 bg-muted rounded-lg p-4 text-sm text-foreground font-mono resize-y border-0 focus:outline-none focus:ring-2 focus:ring-primary/20"
          value={politica}
          onChange={(e) => setPolitica(e.target.value)}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-1">Cláusulas Adicionais</h3>
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
