import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MessageSquare, FileDown, Send } from "lucide-react";
import { toast } from "sonner";
import { useComunicadoresEvolution } from "@/hooks/useComunicadoresEvolution";
import { formatPhoneBrDisplay } from "@/lib/evolutionApi";

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

type CanalEnvio = "oficial" | "proprio";

function sufixoCanal(canal: CanalEnvio, temOficial: boolean, temProprio: boolean): string {
  if (temOficial && temProprio) {
    return canal === "oficial"
      ? "\n\n_Enviado pela linha oficial E-Transporte.pro._"
      : "\n\n_Enviado pelo meu WhatsApp (motorista)._";
  }
  if (temOficial && !temProprio) return "\n\n_Enviado pela linha oficial E-Transporte.pro._";
  if (!temOficial && temProprio) return "\n\n_Enviado pelo meu WhatsApp (motorista)._";
  return "";
}

export default function ComunicarDialog({ open, onOpenChange, dados, telefone, titulo, onGerarPDF }: ComunicarDialogProps) {
  const dadosRef = useRef(dados);
  dadosRef.current = dados;

  const { sistema, own, loading: loadingCanais } = useComunicadoresEvolution();
  const [msgAcima, setMsgAcima] = useState("");
  const [msgAbaixo, setMsgAbaixo] = useState("");
  const [selectedVars, setSelectedVars] = useState<Set<string>>(new Set());
  const [canal, setCanal] = useState<CanalEnvio>("oficial");

  const telOficial = sistema?.telefone_conectado?.trim() || null;
  const telProprio = own?.telefone_conectado?.trim() || null;
  const temOficial = Boolean(telOficial);
  const temProprio = Boolean(telProprio);

  const availableVars = useMemo(
    () =>
      Object.entries(dados)
        .filter(([key, value]) => !ignoredKeys.includes(key) && value != null && value !== "")
        .map(([key, value]) => ({ key, label: labelMap[key] || key, value: String(value) })),
    [dados],
  );

  /** Evita re-selecionar tudo a cada render do pai; só quando abre ou troca o registro */
  const dadosFingerprint = useMemo(() => {
    const rowId = (dados as { id?: string }).id;
    if (rowId != null && rowId !== "") return `id:${rowId}`;
    return availableVars.map((v) => `${v.key}=${v.value}`).join("\u0001");
  }, [dados, availableVars]);

  useEffect(() => {
    if (!open) return;
    if (temProprio && temOficial) setCanal("proprio");
    else if (temProprio) setCanal("proprio");
    else if (temOficial) setCanal("oficial");
  }, [open, temProprio, temOficial]);

  useEffect(() => {
    if (!open) return;
    const keys = Object.entries(dadosRef.current)
      .filter(([key, value]) => !ignoredKeys.includes(key) && value != null && value !== "")
      .map(([key]) => key);
    setSelectedVars(new Set(keys));
  }, [open, dadosFingerprint]);

  const toggleVar = (key: string) => {
    setSelectedVars((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
    const base = buildMessage();
    if (!base.trim()) {
      toast.error("Escreva uma mensagem ou selecione variáveis.");
      return;
    }

    const phone = telefone?.replace(/\D/g, "") || "";
    if (!phone) {
      toast.error("Telefone não disponível.");
      return;
    }

    const suffix = sufixoCanal(canal, temOficial, temProprio);
    const message = base + suffix;

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
          {/* Sempre no topo: escolha do comunicador */}
          <div className="space-y-3 rounded-lg border border-primary/25 bg-muted/30 p-3">
            <Label className="text-foreground text-base">Comunicador</Label>
            {loadingCanais ? (
              <p className="text-sm text-muted-foreground">Carregando canais…</p>
            ) : temOficial && temProprio ? (
              <RadioGroup value={canal} onValueChange={(v) => setCanal(v as CanalEnvio)} className="grid gap-3">
                <div className="flex items-start gap-3 rounded-md border border-transparent px-1 py-0.5 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
                  <RadioGroupItem value="proprio" id="canal-proprio" className="mt-1" />
                  <Label htmlFor="canal-proprio" className="cursor-pointer font-normal leading-snug">
                    <span className="font-medium text-foreground">Meu WhatsApp</span>
                    <span className="block text-xs text-muted-foreground font-mono">{formatPhoneBrDisplay(telProprio!)}</span>
                  </Label>
                </div>
                <div className="flex items-start gap-3 rounded-md border border-transparent px-1 py-0.5 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5">
                  <RadioGroupItem value="oficial" id="canal-oficial" className="mt-1" />
                  <Label htmlFor="canal-oficial" className="cursor-pointer font-normal leading-snug">
                    <span className="font-medium text-foreground">Linha oficial da plataforma</span>
                    <span className="block text-xs text-muted-foreground font-mono">{formatPhoneBrDisplay(telOficial!)}</span>
                  </Label>
                </div>
              </RadioGroup>
            ) : temOficial || temProprio ? (
              <p className="text-sm text-muted-foreground">
                {temOficial && (
                  <>
                    <span className="font-medium text-foreground">Linha oficial</span> — {formatPhoneBrDisplay(telOficial!)}
                  </>
                )}
                {temOficial && temProprio ? <span className="mx-1">·</span> : null}
                {temProprio && (
                  <>
                    <span className="font-medium text-foreground">Meu WhatsApp</span> — {formatPhoneBrDisplay(telProprio!)}
                  </>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum número de comunicador sincronizado. Configure em <strong className="text-foreground">Sistema → Comunicador</strong>. A mensagem será enviada sem rodapé de canal.
              </p>
            )}
            {(temOficial || temProprio) && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                O link abre a conversa com o <strong className="text-foreground">cliente</strong>. Use o WhatsApp já logado na linha escolhida.
              </p>
            )}
          </div>

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

          {/* Variable selector — todas marcadas ao abrir; clique para retirar da mensagem */}
          <div className="space-y-2">
            <div className="space-y-1">
              <Label>Variáveis do registro</Label>
              <p className="text-xs text-muted-foreground">Todas vêm incluídas; clique num chip para excluir da mensagem.</p>
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
                {buildMessage() + sufixoCanal(canal, temOficial, temProprio)}
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
            <Button onClick={handleEnviar} className="flex-1" disabled={loadingCanais}>
              <Send className="h-4 w-4 mr-2" /> Enviar via WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
