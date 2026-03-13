import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeftRight } from "lucide-react";

interface CriarReservaGrupoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CriarReservaGrupoDialog({ open, onOpenChange }: CriarReservaGrupoDialogProps) {
  const [valorBase, setValorBase] = useState("0");
  const [desconto, setDesconto] = useState("0");

  const valorTotal = useMemo(() => {
    const base = parseFloat(valorBase) || 0;
    const desc = parseFloat(desconto) || 0;
    return (base - (base * desc / 100)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }, [valorBase, desconto]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Nova Reserva de Grupo</DialogTitle>
          <p className="text-sm text-muted-foreground">Preencha os dados para criar uma nova reserva de grupo.</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações do Cliente */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Informações do Cliente</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome Completo *</Label>
                <Input required />
              </div>
              <div className="space-y-1.5">
                <Label>CPF/CNPJ *</Label>
                <Input placeholder="000.000.000-00" required />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" required />
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp *</Label>
                <Input required />
              </div>
            </div>
          </div>

          <Separator />

          {/* Detalhes da Viagem */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Detalhes da Viagem</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo de Veículo *</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="micro_onibus">Micro-ônibus</SelectItem>
                    <SelectItem value="onibus">Ônibus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Número de Passageiros *</Label>
                <Input type="number" min="1" required />
              </div>
              <div className="space-y-1.5">
                <Label>Endereço de Embarque *</Label>
                <Input placeholder="Digite o endereço..." required />
              </div>
              <div className="space-y-1.5">
                <Label>Destino *</Label>
                <Input placeholder="Digite o endereço..." required />
              </div>
              <div className="space-y-1.5">
                <Label>Data de Ida *</Label>
                <Input type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label>Hora de Ida *</Label>
                <Input type="time" required />
              </div>
              <div className="space-y-1.5">
                <Label>Data de Retorno (opcional)</Label>
                <Input type="date" />
              </div>
              <div className="space-y-1.5">
                <Label>Hora de Retorno (opcional)</Label>
                <Input type="time" />
              </div>
            </div>
            <div className="mt-4 w-1/2 space-y-1.5">
              <Label>Cupom de Desconto</Label>
              <Input />
            </div>
            <div className="mt-4 space-y-1.5">
              <Label>Observações</Label>
              <Textarea placeholder="Detalhes sobre a excursão, itinerário, necessidades especiais..." />
            </div>
          </div>

          <Separator />

          {/* Veículo e Motorista */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Veículo e Motorista</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Veículo</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Nenhum veículo cadastrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nome do Motorista</Label>
                <Input />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone do Motorista</Label>
                <Input />
              </div>
            </div>
          </div>

          <Separator />

          {/* Valores e Pagamento */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Valores e Pagamento</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Valor Base *</Label>
                <Input type="number" min="0" step="0.01" value={valorBase} onChange={(e) => setValorBase(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Desconto (%)</Label>
                <Input type="number" min="0" max="100" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Método de Pagamento</Label>
                <Input placeholder="Ex: Dinheiro, Cartão, PIX" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-muted px-4 py-2">
              <span className="text-sm font-medium text-primary">Valor Total</span>
              <span className="text-lg font-bold text-foreground">{valorTotal}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary text-primary-foreground">
              <ArrowLeftRight className="h-4 w-4 mr-2" /> Criar Reserva
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
