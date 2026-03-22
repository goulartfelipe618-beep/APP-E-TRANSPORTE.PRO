import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, FileDown, Send } from "lucide-react";
import { toast } from "sonner";

interface ComunicarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dados: Record<string, any>;
  telefone: string | null;
  titulo: string;
  onGerarPDF?: () => void;
}

const labelMap: Record<string, string> = {
  nome_cliente: "Nome do Cliente",
  nome_completo: "Nome Completo",
  nome: "Nome",
  email: "Email",
  telefone: "Telefone",
  contato: "Contato",
  whatsapp: "WhatsApp",
  cpf: "CPF",
  cpf_cnpj: "CPF/CNPJ",
  cnh: "CNH",
  cidade: "Cidade",
  tipo: "Tipo",
  tipo_viagem: "Tipo de Viagem",
  tipo_veiculo: "Tipo de Veículo",
  embarque: "Embarque",
  desembarque: "Desembarque",
  ida_embarque: "Embarque (Ida)",
  ida_desembarque: "Desembarque (Ida)",
  destino: "Destino",
  data_viagem: "Data da Viagem",
  data_ida: "Data de Ida",
  data_retorno: "Data de Retorno",
  hora_viagem: "Hora da Viagem",
  hora_ida: "Hora de Ida",
  hora_retorno: "Hora de Retorno",
  num_passageiros: "Passageiros",
  ida_passageiros: "Passageiros (Ida)",
  mensagem: "Mensagem",
  observacoes: "Observações",
  observacoes_viagem: "Observações",
  cupom: "Cupom",
  status: "Status",
  valor_base: "Valor Base",
  valor_total: "Valor Total",
  desconto: "Desconto",
  metodo_pagamento: "Método de Pagamento",
  nome_motorista: "Nome do Motorista",
  telefone_motorista: "Tel. Motorista",
  numero_reserva: "Nº Reserva",
  quem_viaja: "Quem Viaja",
  volta_embarque: "Embarque (Volta)",
  volta_desembarque: "Desembarque (Volta)",
  volta_data: "Data (Volta)",
  volta_hora: "Hora (Volta)",
  por_hora_endereco_inicio: "Endereço Início",
  por_hora_ponto_encerramento: "Ponto Encerramento",
  por_hora_data: "Data (Por Hora)",
  por_hora_hora: "Hora (Por Hora)",
  por_hora_qtd_horas: "Qtd. Horas",
  por_hora_itinerario: "Itinerário",
};

const ignoredKeys = ["id", "user_id", "created_at", "updated_at", "veiculo_id", "motorista_id", "solicitacao_id"];

export default function ComunicarDialog({ open, onOpenChange, dados, telefone, titulo, onGerarPDF }: ComunicarDialogProps) {
  const [msgAcima, setMsgAcima] = useState("");
  const [msgAbaixo, setMsgAbaixo] = useState("");
  const [selectedVars, setSelectedVars] = useState<Set<string>>(new Set());

  const availableVars = Object.entries(dados)
    .filter(([key, value]) => !ignoredKeys.includes(key) && value != null && value !== "")
    .map(([key, value]) => ({ key, label: labelMap[key] || key, value: String(value) }));

  const toggleVar = (key: string) => {
    setSelectedVars((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedVars(new Set(availableVars.map((v) => v.key)));
  };

  const clearAll = () => {
    setSelectedVars(new Set());
  };

  const buildMessage = () => {
    const parts: string[] = [];
    if (msgAcima.trim()) parts.push(msgAcima.trim());

    if (selectedVars.size > 0) {
      parts.push(""); // empty line
      for (const v of availableVars) {
        if (selectedVars.has(v.key)) {
          parts.push(`*${v.label}:* ${v.value}`);
        }
      }
    }

    if (msgAbaixo.trim()) {
      parts.push(""); // empty line
      parts.push(msgAbaixo.trim());
    }

    return parts.join("\n");
  };

  const handleEnviar = () => {
    const message = buildMessage();
    if (!message.trim()) {
      toast.error("Escreva uma mensagem ou selecione variáveis.");
      return;
    }

    const phone = telefone?.replace(/\D/g, "") || "";
    if (!phone) {
      toast.error("Telefone não disponível.");
      return;
    }

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            {titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Message above */}
          <div className="space-y-1.5">
            <Label>Mensagem Inicial</Label>
            <Textarea
              placeholder="Escreva uma saudação ou mensagem inicial..."
              value={msgAcima}
              onChange={(e) => setMsgAcima(e.target.value)}
              rows={3}
            />
          </div>

          {/* Variable selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Selecione as variáveis</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={selectAll}>
                  Selecionar Tudo
                </Button>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearAll}>
                  Limpar
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto rounded-lg border border-border p-3 bg-muted/30">
              {availableVars.map((v) => (
                <Badge
                  key={v.key}
                  variant={selectedVars.has(v.key) ? "default" : "outline"}
                  className="cursor-pointer select-none transition-colors"
                  onClick={() => toggleVar(v.key)}
                >
                  {v.label}: <span className="font-normal ml-1 max-w-[100px] truncate">{v.value}</span>
                </Badge>
              ))}
              {availableVars.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma variável disponível.</p>
              )}
            </div>
          </div>

          {/* Message below */}
          <div className="space-y-1.5">
            <Label>Mensagem Final</Label>
            <Textarea
              placeholder="Escreva uma mensagem de encerramento..."
              value={msgAbaixo}
              onChange={(e) => setMsgAbaixo(e.target.value)}
              rows={3}
            />
          </div>

          {/* Preview */}
          {(msgAcima || selectedVars.size > 0 || msgAbaixo) && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Pré-visualização</Label>
              <div className="rounded-lg border border-border bg-card p-3 text-sm whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                {buildMessage()}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-border">
            {onGerarPDF && (
              <Button variant="outline" onClick={onGerarPDF} className="flex-1">
                <FileDown className="h-4 w-4 mr-2" /> Gerar PDF
              </Button>
            )}
            <Button onClick={handleEnviar} className="flex-1">
              <Send className="h-4 w-4 mr-2" /> Enviar via WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
