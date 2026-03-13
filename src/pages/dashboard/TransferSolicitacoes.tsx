import { useState } from "react";
import { RefreshCw, Download, Plus, X, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function TransferSolicitacoesPage() {
  const [open, setOpen] = useState(false);
  const [tipoViagem, setTipoViagem] = useState("ida");
  const [quemFaz, setQuemFaz] = useState("motorista");
  const [valorBase, setValorBase] = useState(0);
  const [desconto, setDesconto] = useState(0);

  const valorTotal = valorBase - (valorBase * desconto) / 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitações de Transfer</h1>
          <p className="text-muted-foreground">Registros recebidos via webhook do site. Converta em reserva para confirmar.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Exportar CSV</Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Criar Reserva</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3">Solicitações Recebidas</h3>
        <p className="text-sm text-muted-foreground">Nenhuma solicitação recebida.</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Nova Reserva</DialogTitle>
            <DialogDescription>Preencha os dados para criar uma nova reserva manual.</DialogDescription>
          </DialogHeader>

          {/* Informações do Cliente */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-foreground border-b border-border pb-2 w-full">Informações do Cliente</legend>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nome Completo *</Label><Input placeholder="" /></div>
              <div><Label>CPF/CNPJ *</Label><Input placeholder="000.000.000-00" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Email *</Label><Input type="email" /></div>
              <div><Label>Telefone *</Label><Input /></div>
            </div>
          </fieldset>

          {/* Detalhes da Viagem */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-foreground border-b border-border pb-2 w-full">Detalhes da Viagem</legend>
            <div>
              <Label>Tipo de Viagem *</Label>
              <Select value={tipoViagem} onValueChange={setTipoViagem}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ida">Somente Ida</SelectItem>
                  <SelectItem value="ida_volta">Ida e Volta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-4">
              <p className="text-sm font-medium text-foreground">→ Ida</p>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Local de Embarque (IDA) *</Label><Input placeholder="Digite o endereço..." /></div>
                <div><Label>Local de Desembarque (IDA) *</Label><Input placeholder="Digite o endereço..." /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Data/Hora do Embarque (IDA) *</Label><Input type="date" /></div>
                <div><Label>Hora</Label><Input type="time" /></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Número de Passageiros *</Label><Input type="number" /></div>
              <div><Label>Cupom</Label><Input /></div>
            </div>
            <div><Label>Mensagem / Observações</Label><Textarea placeholder="" /></div>
          </fieldset>

          {/* Veículo e Motorista */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-foreground border-b border-border pb-2 w-full">Veículo e Motorista</legend>
            <div>
              <Label>Quem fará a viagem? *</Label>
              <Select value={quemFaz} onValueChange={setQuemFaz}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="motorista">Motorista</SelectItem>
                  <SelectItem value="parceiro">Parceiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Motorista *</Label>
                <Select><SelectTrigger><SelectValue placeholder="Selecione um motorista" /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem></SelectContent></Select>
              </div>
              <div>
                <Label>Veículo</Label>
                <Select disabled><SelectTrigger><SelectValue placeholder="Selecione um motorista primeiro" /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem></SelectContent></Select>
              </div>
            </div>
          </fieldset>

          {/* Valores e Pagamento */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-foreground border-b border-border pb-2 w-full">Valores e Pagamento</legend>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Valor Base *</Label><Input type="number" value={valorBase} onChange={e => setValorBase(Number(e.target.value))} /></div>
              <div><Label>Desconto (%)</Label><Input type="number" value={desconto} onChange={e => setDesconto(Number(e.target.value))} /></div>
              <div><Label>Método de Pagamento</Label><Input placeholder="Ex: Dinheiro, Cartão, PIX" /></div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <span className="text-sm font-medium text-foreground">Valor Total</span>
              <span className="text-sm font-bold text-foreground">R$ {valorTotal.toFixed(2).replace('.', ',')}</span>
            </div>
          </fieldset>

          {/* Observações */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-foreground border-b border-border pb-2 w-full">Observações</legend>
            <Textarea placeholder="Observações adicionais sobre a reserva..." />
          </fieldset>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button><ListFilter className="h-4 w-4 mr-2" /> Criar Reserva</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
