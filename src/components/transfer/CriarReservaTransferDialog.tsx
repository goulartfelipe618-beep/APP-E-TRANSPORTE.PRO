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

export interface TransferInitialData {
  nome_completo?: string;
  contato?: string;
  email?: string;
  tipo?: string;
  embarque?: string;
  desembarque?: string;
  data_viagem?: string;
  hora_viagem?: string;
  num_passageiros?: number | null;
  mensagem?: string;
  cupom?: string;
  // Volta
  volta_embarque?: string;
  volta_desembarque?: string;
  volta_data?: string;
  volta_hora?: string;
  volta_passageiros?: number | null;
  volta_mensagem?: string;
  volta_cupom?: string;
  // Por hora
  por_hora_endereco_inicio?: string;
  por_hora_ponto_encerramento?: string;
  por_hora_data?: string;
  por_hora_hora?: string;
  por_hora_passageiros?: number | null;
  por_hora_qtd_horas?: number | null;
  por_hora_cupom?: string;
  por_hora_itinerario?: string;
  solicitacao_id?: string;
}

interface CriarReservaTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  initialData?: TransferInitialData | null;
}

type TipoViagem = "somente_ida" | "ida_volta" | "por_hora";
type QuemViaja = "motorista" | "eu_mesmo";

export default function CriarReservaTransferDialog({ open, onOpenChange, onCreated, initialData }: CriarReservaTransferDialogProps) {
  const [tipoViagem, setTipoViagem] = useState<TipoViagem>("somente_ida");
  const [quemViaja, setQuemViaja] = useState<QuemViaja>("motorista");
  const [valorBase, setValorBase] = useState("0");
  const [desconto, setDesconto] = useState("0");
  const [saving, setSaving] = useState(false);

  // Form fields
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [idaEmbarque, setIdaEmbarque] = useState("");
  const [idaDesembarque, setIdaDesembarque] = useState("");
  const [idaData, setIdaData] = useState("");
  const [idaHora, setIdaHora] = useState("");
  const [idaPassageiros, setIdaPassageiros] = useState("");
  const [idaCupom, setIdaCupom] = useState("");
  const [idaMensagem, setIdaMensagem] = useState("");
  const [voltaEmbarque, setVoltaEmbarque] = useState("");
  const [voltaDesembarque, setVoltaDesembarque] = useState("");
  const [voltaData, setVoltaData] = useState("");
  const [voltaHora, setVoltaHora] = useState("");
  const [voltaPassageiros, setVoltaPassageiros] = useState("");
  const [voltaCupom, setVoltaCupom] = useState("");
  const [voltaMensagem, setVoltaMensagem] = useState("");
  const [porHoraEnderecoInicio, setPorHoraEnderecoInicio] = useState("");
  const [porHoraPontoEncerramento, setPorHoraPontoEncerramento] = useState("");
  const [porHoraData, setPorHoraData] = useState("");
  const [porHoraHora, setPorHoraHora] = useState("");
  const [porHoraPassageiros, setPorHoraPassageiros] = useState("");
  const [porHoraQtdHoras, setPorHoraQtdHoras] = useState("");
  const [porHoraCupom, setPorHoraCupom] = useState("");
  const [porHoraItinerario, setPorHoraItinerario] = useState("");
  const [metodoPagamento, setMetodoPagamento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const valorTotalNum = useMemo(() => {
    const base = parseFloat(valorBase) || 0;
    const desc = parseFloat(desconto) || 0;
    return base - (base * desc / 100);
  }, [valorBase, desconto]);

  const valorTotalFormatted = valorTotalNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Pre-fill from solicitação data
  useEffect(() => {
    if (open && initialData) {
      setNomeCompleto(initialData.nome_completo || "");
      setTelefone(initialData.contato || "");
      setIdaEmbarque(initialData.embarque || "");
      setIdaDesembarque(initialData.desembarque || "");
      setIdaData(initialData.data_viagem || "");
      setIdaPassageiros(initialData.num_passageiros?.toString() || "");
      setObservacoes(initialData.mensagem || "");
      if (initialData.tipo) {
        const tipoMap: Record<string, TipoViagem> = { ida: "somente_ida", ida_volta: "ida_volta", por_hora: "por_hora" };
        setTipoViagem(tipoMap[initialData.tipo] || "somente_ida");
      }
    }
    if (open && !initialData) resetForm();
  }, [open, initialData]);

  const resetForm = () => {
    setNomeCompleto(""); setCpfCnpj(""); setEmail(""); setTelefone("");
    setTipoViagem("somente_ida"); setQuemViaja("motorista");
    setIdaEmbarque(""); setIdaDesembarque(""); setIdaData(""); setIdaHora("");
    setIdaPassageiros(""); setIdaCupom(""); setIdaMensagem("");
    setVoltaEmbarque(""); setVoltaDesembarque(""); setVoltaData(""); setVoltaHora("");
    setVoltaPassageiros(""); setVoltaCupom(""); setVoltaMensagem("");
    setPorHoraEnderecoInicio(""); setPorHoraPontoEncerramento(""); setPorHoraData("");
    setPorHoraHora(""); setPorHoraPassageiros(""); setPorHoraQtdHoras("");
    setPorHoraCupom(""); setPorHoraItinerario("");
    setValorBase("0"); setDesconto("0"); setMetodoPagamento(""); setObservacoes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Você precisa estar logado."); setSaving(false); return; }

    const { error } = await supabase.from("reservas_transfer").insert({
      user_id: user.id,
      nome_completo: nomeCompleto,
      cpf_cnpj: cpfCnpj,
      email,
      telefone,
      tipo_viagem: tipoViagem,
      quem_viaja: quemViaja,
      ida_embarque: idaEmbarque || null,
      ida_desembarque: idaDesembarque || null,
      ida_data: idaData || null,
      ida_hora: idaHora || null,
      ida_passageiros: idaPassageiros ? parseInt(idaPassageiros) : null,
      ida_cupom: idaCupom || null,
      ida_mensagem: idaMensagem || null,
      volta_embarque: voltaEmbarque || null,
      volta_desembarque: voltaDesembarque || null,
      volta_data: voltaData || null,
      volta_hora: voltaHora || null,
      volta_passageiros: voltaPassageiros ? parseInt(voltaPassageiros) : null,
      volta_cupom: voltaCupom || null,
      volta_mensagem: voltaMensagem || null,
      por_hora_endereco_inicio: porHoraEnderecoInicio || null,
      por_hora_ponto_encerramento: porHoraPontoEncerramento || null,
      por_hora_data: porHoraData || null,
      por_hora_hora: porHoraHora || null,
      por_hora_passageiros: porHoraPassageiros ? parseInt(porHoraPassageiros) : null,
      por_hora_qtd_horas: porHoraQtdHoras ? parseInt(porHoraQtdHoras) : null,
      por_hora_cupom: porHoraCupom || null,
      por_hora_itinerario: porHoraItinerario || null,
      valor_base: parseFloat(valorBase) || 0,
      desconto: parseFloat(desconto) || 0,
      valor_total: valorTotalNum,
      metodo_pagamento: metodoPagamento || null,
      observacoes: observacoes || null,
    });

    setSaving(false);
    if (error) {
      toast.error("Erro ao criar reserva: " + error.message);
    } else {
      toast.success("Reserva criada com sucesso!");
      resetForm();
      onOpenChange(false);
      onCreated?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Nova Reserva</DialogTitle>
          <p className="text-sm text-muted-foreground">Preencha os dados para criar uma nova reserva manual.</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações do Cliente */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Informações do Cliente</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome Completo *</Label>
                <Input required value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>CPF/CNPJ *</Label>
                <Input placeholder="000.000.000-00" required value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone *</Label>
                <Input required value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Detalhes da Viagem */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Detalhes da Viagem</h3>
            <div className="space-y-4">
              <div className="w-1/2 space-y-1.5">
                <Label>Tipo de Viagem *</Label>
                <Select value={tipoViagem} onValueChange={(v) => setTipoViagem(v as TipoViagem)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="somente_ida">Somente Ida</SelectItem>
                    <SelectItem value="ida_volta">Ida e Volta</SelectItem>
                    <SelectItem value="por_hora">Por Hora</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(tipoViagem === "somente_ida" || tipoViagem === "ida_volta") && (
                <div className="rounded-lg border border-border p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">→ Ida</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label>Local de Embarque (IDA) *</Label><Input placeholder="Digite o endereço..." required value={idaEmbarque} onChange={(e) => setIdaEmbarque(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Local de Desembarque (IDA) *</Label><Input placeholder="Digite o endereço..." required value={idaDesembarque} onChange={(e) => setIdaDesembarque(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Data do Embarque (IDA) *</Label><Input type="date" required value={idaData} onChange={(e) => setIdaData(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Hora</Label><Input type="time" value={idaHora} onChange={(e) => setIdaHora(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Número de Passageiros *</Label><Input type="number" min="1" required value={idaPassageiros} onChange={(e) => setIdaPassageiros(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Cupom</Label><Input value={idaCupom} onChange={(e) => setIdaCupom(e.target.value)} /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Mensagem / Observações</Label><Textarea value={idaMensagem} onChange={(e) => setIdaMensagem(e.target.value)} /></div>
                </div>
              )}

              {tipoViagem === "ida_volta" && (
                <div className="rounded-lg border border-border p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">⇆ Volta</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label>Local de Embarque (Volta)</Label><Input placeholder="Digite o endereço..." value={voltaEmbarque} onChange={(e) => setVoltaEmbarque(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Local de Desembarque (Volta)</Label><Input placeholder="Digite o endereço..." value={voltaDesembarque} onChange={(e) => setVoltaDesembarque(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={voltaData} onChange={(e) => setVoltaData(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Hora</Label><Input type="time" value={voltaHora} onChange={(e) => setVoltaHora(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Passageiros</Label><Input type="number" min="1" value={voltaPassageiros} onChange={(e) => setVoltaPassageiros(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Cupom</Label><Input value={voltaCupom} onChange={(e) => setVoltaCupom(e.target.value)} /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Mensagem / Observações</Label><Textarea value={voltaMensagem} onChange={(e) => setVoltaMensagem(e.target.value)} /></div>
                </div>
              )}

              {tipoViagem === "por_hora" && (
                <div className="rounded-lg border border-border p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">⏱ Por Hora</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label>Endereço de Início</Label><Input placeholder="Digite o endereço..." value={porHoraEnderecoInicio} onChange={(e) => setPorHoraEnderecoInicio(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Ponto de Encerramento</Label><Input placeholder="Digite o endereço..." value={porHoraPontoEncerramento} onChange={(e) => setPorHoraPontoEncerramento(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={porHoraData} onChange={(e) => setPorHoraData(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Hora</Label><Input type="time" value={porHoraHora} onChange={(e) => setPorHoraHora(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Passageiros</Label><Input type="number" min="1" value={porHoraPassageiros} onChange={(e) => setPorHoraPassageiros(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Qtd. Horas</Label><Input type="number" min="1" value={porHoraQtdHoras} onChange={(e) => setPorHoraQtdHoras(e.target.value)} /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Cupom</Label><Input value={porHoraCupom} onChange={(e) => setPorHoraCupom(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Itinerário / Observações</Label><Textarea value={porHoraItinerario} onChange={(e) => setPorHoraItinerario(e.target.value)} /></div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Veículo e Motorista */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Veículo e Motorista</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Quem fará a viagem? *</Label>
                <Select value={quemViaja} onValueChange={(v) => setQuemViaja(v as QuemViaja)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motorista">Motorista</SelectItem>
                    <SelectItem value="eu_mesmo">Eu mesmo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {quemViaja === "motorista" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Motorista *</Label>
                    <Select><SelectTrigger><SelectValue placeholder="Selecione um motorista" /></SelectTrigger>
                      <SelectContent><SelectItem value="none" disabled>Nenhum motorista cadastrado</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Veículo</Label>
                    <Select disabled><SelectTrigger><SelectValue placeholder="Selecione um motorista primeiro" /></SelectTrigger>
                      <SelectContent><SelectItem value="none" disabled>—</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Valores e Pagamento */}
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

          <Separator />

          <div>
            <h3 className="font-semibold text-foreground mb-3">Observações</h3>
            <Textarea placeholder="Observações adicionais sobre a reserva..." value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
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
