import { useState } from "react";
import { RefreshCw, Download, Plus, ListFilter } from "lucide-react";
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

export default function GruposSolicitacoesPage() {
  const [open, setOpen] = useState(false);
  const [valorBase, setValorBase] = useState(0);
  const [desconto, setDesconto] = useState(0);

  const valorTotal = valorBase - (valorBase * desconto) / 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitações de Grupos</h1>
          <p className="text-muted-foreground">Registros recebidos via webhook. Converta em reserva para confirmar.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Exportar CSV</Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Criar Reserva</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3">Solicitações Recebidas</h3>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Nova Reserva de Grupo</DialogTitle>
            <DialogDescription>Preencha os dados para criar uma nova reserva de grupo.</DialogDescription>
          </DialogHeader>

          {/* Informações do Cliente */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-foreground border-b border-border pb-2 w-full">Informações do Cliente</legend>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nome Completo *</Label><Input /></div>
              <div><Label>CPF/CNPJ *</Label><Input placeholder="000.000.000-00" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Email *</Label><Input type="email" /></div>
              <div><Label>WhatsApp *</Label><Input /></div>
            </div>
          </fieldset>

          {/* Detalhes da Viagem */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-foreground border-b border-border pb-2 w-full">Detalhes da Viagem</legend>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Veículo *</Label>
                <Select><SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger><SelectContent><SelectItem value="van">Van</SelectItem><SelectItem value="micro">Micro-ônibus</SelectItem><SelectItem value="onibus">Ônibus</SelectItem></SelectContent></Select>
              </div>
              <div><Label>Número de Passageiros *</Label><Input type="number" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Endereço de Embarque *</Label><Input placeholder="Digite o endereço..." /></div>
              <div><Label>Destino *</Label><Input placeholder="Digite o endereço..." /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data de Ida *</Label><Input type="date" /></div>
              <div><Label>Hora de Ida *</Label><Input type="time" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data de Retorno (opcional)</Label><Input type="date" /></div>
              <div><Label>Hora de Retorno (opcional)</Label><Input type="time" /></div>
            </div>
            <div className="w-1/2"><Label>Cupom de Desconto</Label><Input /></div>
            <div><Label>Observações</Label><Textarea placeholder="Detalhes sobre a excursão, itinerário, necessidades especiais..." /></div>
          </fieldset>

          {/* Veículo e Motorista */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-foreground border-b border-border pb-2 w-full">Veículo e Motorista</legend>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Veículo</Label>
                <Select><SelectTrigger><SelectValue placeholder="Selecione um veículo" /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem></SelectContent></Select>
              </div>
              <div><Label>Nome do Motorista</Label><Input /></div>
              <div><Label>Telefone do Motorista</Label><Input /></div>
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

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button><ListFilter className="h-4 w-4 mr-2" /> Criar Reserva</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
