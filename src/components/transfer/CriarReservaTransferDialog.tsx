import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeftRight } from "lucide-react";

interface CriarReservaTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TipoViagem = "somente_ida" | "ida_volta" | "por_hora";
type QuemViaja = "motorista" | "eu_mesmo";

export default function CriarReservaTransferDialog({ open, onOpenChange }: CriarReservaTransferDialogProps) {
  const [tipoViagem, setTipoViagem] = useState<TipoViagem>("somente_ida");
  const [quemViaja, setQuemViaja] = useState<QuemViaja>("motorista");
  const [valorBase, setValorBase] = useState("0");
  const [desconto, setDesconto] = useState("0");

  const valorTotal = useMemo(() => {
    const base = parseFloat(valorBase) || 0;
    const desc = parseFloat(desconto) || 0;
    const total = base - (base * desc / 100);
    return total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }, [valorBase, desconto]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: integrate with backend
    onOpenChange(false);
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
                <Label>Telefone *</Label>
                <Input required />
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="somente_ida">Somente Ida</SelectItem>
                    <SelectItem value="ida_volta">Ida e Volta</SelectItem>
                    <SelectItem value="por_hora">Por Hora</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Somente Ida / Ida e Volta */}
              {(tipoViagem === "somente_ida" || tipoViagem === "ida_volta") && (
                <div className="rounded-lg border border-border p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">→ Ida</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Local de Embarque (IDA) *</Label>
                      <Input placeholder="Digite o endereço..." required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Local de Desembarque (IDA) *</Label>
                      <Input placeholder="Digite o endereço..." required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Data/Hora do Embarque (IDA) *</Label>
                      <Input type="date" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Hora</Label>
                      <Input type="time" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Número de Passageiros *</Label>
                      <Input type="number" min="1" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cupom</Label>
                      <Input />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mensagem / Observações</Label>
                    <Textarea />
                  </div>
                </div>
              )}

              {/* Volta (only for ida_volta) */}
              {tipoViagem === "ida_volta" && (
                <div className="rounded-lg border border-border p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">⇆ Volta</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Local de Embarque (Volta)</Label>
                      <Input placeholder="Digite o endereço..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Local de Desembarque (Volta)</Label>
                      <Input placeholder="Digite o endereço..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Data</Label>
                      <Input type="date" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Hora</Label>
                      <Input type="time" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Passageiros</Label>
                      <Input type="number" min="1" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cupom</Label>
                      <Input />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mensagem / Observações</Label>
                    <Textarea />
                  </div>
                </div>
              )}

              {/* Por Hora */}
              {tipoViagem === "por_hora" && (
                <div className="rounded-lg border border-border p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-foreground">⏱ Por Hora</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Endereço de Início</Label>
                      <Input placeholder="Digite o endereço..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Ponto de Encerramento</Label>
                      <Input placeholder="Digite o endereço..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Data</Label>
                      <Input type="date" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Hora</Label>
                      <Input type="time" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Passageiros</Label>
                      <Input type="number" min="1" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Qtd. Horas</Label>
                      <Input type="number" min="1" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cupom</Label>
                    <Input />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Itinerário / Observações</Label>
                    <Textarea />
                  </div>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um motorista" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" disabled>Nenhum motorista cadastrado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Veículo</Label>
                    <Select disabled>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um motorista primeiro" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" disabled>—</SelectItem>
                      </SelectContent>
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

          <Separator />

          {/* Observações */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Observações</h3>
            <Textarea placeholder="Observações adicionais sobre a reserva..." />
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
