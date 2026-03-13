import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GrupoInitialData {
  nome_cliente?: string;
  whatsapp?: string;
  tipo_veiculo?: string;
  embarque?: string;
  destino?: string;
  data_ida?: string;
  num_passageiros?: number | null;
  mensagem?: string;
  solicitacao_id?: string;
}

interface CriarReservaGrupoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  initialData?: GrupoInitialData | null;
}

export default function CriarReservaGrupoDialog({ open, onOpenChange, onCreated, initialData }: CriarReservaGrupoDialogProps) {
  const [saving, setSaving] = useState(false);
  const [valorBase, setValorBase] = useState("0");
  const [desconto, setDesconto] = useState("0");

  const [nomeCompleto, setNomeCompleto] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [tipoVeiculo, setTipoVeiculo] = useState("");
  const [numPassageiros, setNumPassageiros] = useState("");
  const [embarque, setEmbarque] = useState("");
  const [destino, setDestino] = useState("");
  const [dataIda, setDataIda] = useState("");
  const [horaIda, setHoraIda] = useState("");
  const [dataRetorno, setDataRetorno] = useState("");
  const [horaRetorno, setHoraRetorno] = useState("");
  const [cupom, setCupom] = useState("");
  const [observacoesViagem, setObservacoesViagem] = useState("");
  const [nomeMotorista, setNomeMotorista] = useState("");
  const [telefoneMotorista, setTelefoneMotorista] = useState("");
  const [metodoPagamento, setMetodoPagamento] = useState("");

  const valorTotalNum = useMemo(() => {
    const base = parseFloat(valorBase) || 0;
    const desc = parseFloat(desconto) || 0;
    return base - (base * desc / 100);
  }, [valorBase, desconto]);

  const valorTotalFormatted = valorTotalNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Pre-fill from solicitação data
  useEffect(() => {
    if (open && initialData) {
      setNomeCompleto(initialData.nome_cliente || "");
      setWhatsapp(initialData.whatsapp || "");
      setTipoVeiculo(initialData.tipo_veiculo || "");
      setEmbarque(initialData.embarque || "");
      setDestino(initialData.destino || "");
      setDataIda(initialData.data_ida || "");
      setNumPassageiros(initialData.num_passageiros?.toString() || "");
      setObservacoesViagem(initialData.mensagem || "");
    }
    if (open && !initialData) resetForm();
  }, [open, initialData]);

  const resetForm = () => {
    setNomeCompleto(""); setCpfCnpj(""); setEmail(""); setWhatsapp("");
    setTipoVeiculo(""); setNumPassageiros(""); setEmbarque(""); setDestino("");
    setDataIda(""); setHoraIda(""); setDataRetorno(""); setHoraRetorno("");
    setCupom(""); setObservacoesViagem(""); setNomeMotorista(""); setTelefoneMotorista("");
    setValorBase("0"); setDesconto("0"); setMetodoPagamento("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Você precisa estar logado."); setSaving(false); return; }

    const { error } = await supabase.from("reservas_grupos").insert({
      user_id: user.id,
      nome_completo: nomeCompleto,
      cpf_cnpj: cpfCnpj,
      email,
      whatsapp,
      tipo_veiculo: tipoVeiculo || null,
      num_passageiros: numPassageiros ? parseInt(numPassageiros) : null,
      embarque: embarque || null,
      destino: destino || null,
      data_ida: dataIda || null,
      hora_ida: horaIda || null,
      data_retorno: dataRetorno || null,
      hora_retorno: horaRetorno || null,
      cupom: cupom || null,
      observacoes_viagem: observacoesViagem || null,
      nome_motorista: nomeMotorista || null,
      telefone_motorista: telefoneMotorista || null,
      valor_base: parseFloat(valorBase) || 0,
      desconto: parseFloat(desconto) || 0,
      valor_total: valorTotalNum,
      metodo_pagamento: metodoPagamento || null,
    });

    setSaving(false);
    if (error) {
      toast.error("Erro ao criar reserva: " + error.message);
    } else {
      toast.success("Reserva de grupo criada com sucesso!");
      resetForm();
      onOpenChange(false);
      onCreated?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Nova Reserva de Grupo</DialogTitle>
          <p className="text-sm text-muted-foreground">Preencha os dados para criar uma nova reserva de grupo.</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h3 className="font-semibold text-foreground mb-3">Informações do Cliente</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Nome Completo *</Label><Input required value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>CPF/CNPJ *</Label><Input placeholder="000.000.000-00" required value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Email *</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>WhatsApp *</Label><Input required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold text-foreground mb-3">Detalhes da Viagem</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo de Veículo *</Label>
                <Select value={tipoVeiculo} onValueChange={setTipoVeiculo}>
                  <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="micro_onibus">Micro-ônibus</SelectItem>
                    <SelectItem value="onibus">Ônibus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Número de Passageiros *</Label><Input type="number" min="1" required value={numPassageiros} onChange={(e) => setNumPassageiros(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Endereço de Embarque *</Label><Input placeholder="Digite o endereço..." required value={embarque} onChange={(e) => setEmbarque(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Destino *</Label><Input placeholder="Digite o endereço..." required value={destino} onChange={(e) => setDestino(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Data de Ida *</Label><Input type="date" required value={dataIda} onChange={(e) => setDataIda(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Hora de Ida *</Label><Input type="time" required value={horaIda} onChange={(e) => setHoraIda(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Data de Retorno (opcional)</Label><Input type="date" value={dataRetorno} onChange={(e) => setDataRetorno(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Hora de Retorno (opcional)</Label><Input type="time" value={horaRetorno} onChange={(e) => setHoraRetorno(e.target.value)} /></div>
            </div>
            <div className="mt-4 w-1/2 space-y-1.5"><Label>Cupom de Desconto</Label><Input value={cupom} onChange={(e) => setCupom(e.target.value)} /></div>
            <div className="mt-4 space-y-1.5"><Label>Observações</Label><Textarea placeholder="Detalhes sobre a excursão, itinerário, necessidades especiais..." value={observacoesViagem} onChange={(e) => setObservacoesViagem(e.target.value)} /></div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold text-foreground mb-3">Veículo e Motorista</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Veículo</Label>
                <Select><SelectTrigger><SelectValue placeholder="Selecione um veículo" /></SelectTrigger>
                  <SelectContent><SelectItem value="none" disabled>Nenhum veículo cadastrado</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Nome do Motorista</Label><Input value={nomeMotorista} onChange={(e) => setNomeMotorista(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Telefone do Motorista</Label><Input value={telefoneMotorista} onChange={(e) => setTelefoneMotorista(e.target.value)} /></div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold text-foreground mb-3">Valores e Pagamento</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Valor Base *</Label><Input type="number" min="0" step="0.01" value={valorBase} onChange={(e) => setValorBase(e.target.value)} required /></div>
              <div className="space-y-1.5"><Label>Desconto (%)</Label><Input type="number" min="0" max="100" value={desconto} onChange={(e) => setDesconto(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Método de Pagamento</Label><Input placeholder="Ex: Dinheiro, Cartão, PIX" value={metodoPagamento} onChange={(e) => setMetodoPagamento(e.target.value)} /></div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-muted px-4 py-2">
              <span className="text-sm font-medium text-primary">Valor Total</span>
              <span className="text-lg font-bold text-foreground">{valorTotalFormatted}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="bg-primary text-primary-foreground" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowLeftRight className="h-4 w-4 mr-2" />}
              Criar Reserva
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
