import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Code2, Send } from "lucide-react";

interface FerramentasDevDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: string;
  onSubmit: (payload: Record<string, string>) => void;
}

// Step definitions per type
const transferStep1Fields = [
  { key: "tipo_viagem", label: "Tipo de Viagem", type: "select", options: ["Somente Ida", "Ida e Volta", "Por Hora"] },
];

const transferIdaFields = [
  { key: "passageiros_ida", label: "Passageiros (Ida)", type: "text" },
  { key: "embarque_ida", label: "Embarque (Ida)", type: "text" },
  { key: "destino_ida", label: "Destino (Ida)", type: "text" },
  { key: "data_ida", label: "Data (Ida)", type: "date" },
  { key: "hora_ida", label: "Hora (Ida)", type: "time" },
  { key: "mensagem_ida", label: "Mensagem (Ida)", type: "textarea" },
  { key: "cupom_ida", label: "Cupom (Ida)", type: "text" },
];

const transferVoltaFields = [
  { key: "passageiros_volta", label: "Passageiros (Volta)", type: "text" },
  { key: "embarque_volta", label: "Embarque (Volta)", type: "text" },
  { key: "destino_volta", label: "Destino (Volta)", type: "text" },
  { key: "data_volta", label: "Data (Volta)", type: "date" },
  { key: "hora_volta", label: "Hora (Volta)", type: "time" },
  { key: "mensagem_volta", label: "Mensagem (Volta)", type: "textarea" },
  { key: "cupom_volta", label: "Cupom (Volta)", type: "text" },
];

const transferPorHoraFields = [
  { key: "passageiros", label: "Passageiros", type: "text" },
  { key: "endereco_inicio", label: "Endereço de Início", type: "text" },
  { key: "data", label: "Data", type: "date" },
  { key: "hora", label: "Hora", type: "time" },
  { key: "qtd_horas", label: "Qtd. Horas", type: "text" },
  { key: "ponto_encerramento", label: "Ponto de Encerramento", type: "text" },
  { key: "itinerario_mensagem", label: "Itinerário / Mensagem", type: "textarea" },
  { key: "cupom", label: "Cupom", type: "text" },
];

const grupoTravelFields = [
  { key: "tipo_veiculo", label: "Tipo de Veículo", type: "select", options: ["Van", "Micro-ônibus", "Ônibus"] },
  { key: "num_passageiros", label: "Número de Passageiros", type: "text" },
  { key: "embarque", label: "Endereço de Embarque", type: "text" },
  { key: "destino", label: "Destino", type: "text" },
  { key: "data_ida", label: "Data de Ida", type: "date" },
  { key: "hora_ida", label: "Hora de Ida", type: "time" },
  { key: "data_retorno", label: "Data de Retorno", type: "date" },
  { key: "hora_retorno", label: "Hora de Retorno", type: "time" },
  { key: "observacoes", label: "Observações", type: "textarea" },
  { key: "cupom_desconto", label: "Cupom de Desconto", type: "text" },
];

const motoristaFields = [
  { key: "cpf", label: "CPF", type: "text" },
  { key: "data_nascimento", label: "Data de Nascimento", type: "date" },
  { key: "endereco_completo", label: "Endereço Completo", type: "text" },
  { key: "cidade", label: "Cidade", type: "text" },
  { key: "estado", label: "Estado", type: "text" },
  { key: "numero_cnh", label: "Número da CNH", type: "text" },
  { key: "categoria_cnh", label: "Categoria da CNH", type: "select", options: ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"] },
  { key: "possui_veiculo", label: "Possui Veículo", type: "select", options: ["Sim", "Não"] },
  { key: "marca_veiculo", label: "Marca do Veículo", type: "text" },
  { key: "modelo_veiculo", label: "Modelo do Veículo", type: "text" },
  { key: "ano_veiculo", label: "Ano do Veículo", type: "text" },
  { key: "placa_veiculo", label: "Placa do Veículo", type: "text" },
  { key: "experiencia", label: "Experiência", type: "textarea" },
  { key: "mensagem_observacoes", label: "Mensagem / Observações", type: "textarea" },
];

// Personal info step (shared across all types)
const personalInfoFields = [
  { key: "nome_completo", label: "Nome Completo", type: "text" },
  { key: "telefone", label: "Número de Telefone", type: "text" },
  { key: "email", label: "E-mail", type: "text" },
  { key: "como_encontrou", label: "Por onde nos encontrou?", type: "select", options: ["Google", "Instagram", "Facebook", "Indicação", "Outro"] },
];

type FieldDef = { key: string; label: string; type: string; options?: string[] };

function FieldRenderer({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  if (field.type === "select") {
    return (
      <div className="space-y-1">
        <Label className="text-sm">{field.label}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder={`Selecione...`} /></SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <div className="space-y-1">
        <Label className="text-sm">{field.label}</Label>
        <Textarea placeholder={field.label} value={value} onChange={(e) => onChange(e.target.value)} rows={2} />
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Label className="text-sm">{field.label}</Label>
      <Input type={field.type === "date" ? "date" : field.type === "time" ? "time" : "text"} placeholder={field.label} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function FerramentasDevDialog({ open, onOpenChange, tipo, onSubmit }: FerramentasDevDialogProps) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const tipoViagem = formData["tipo_viagem"] || "";

  const steps = useMemo(() => {
    if (tipo === "transfer") {
      const step1: { title: string; fields: FieldDef[] } = { title: "Tipo de Viagem", fields: transferStep1Fields };
      let step2Fields: FieldDef[] = transferIdaFields;
      let step2Title = "Dados da Viagem (Ida)";
      if (tipoViagem === "Ida e Volta") {
        step2Fields = transferIdaFields;
        step2Title = "Dados da Ida";
      } else if (tipoViagem === "Por Hora") {
        step2Fields = transferPorHoraFields;
        step2Title = "Dados da Viagem";
      }

      const result = [step1, { title: step2Title, fields: step2Fields }];
      if (tipoViagem === "Ida e Volta") {
        result.push({ title: "Dados da Volta", fields: transferVoltaFields });
      }
      result.push({ title: "Informações Pessoais", fields: personalInfoFields });
      return result;
    }
    if (tipo === "grupo") {
      return [
        { title: "Dados da Viagem", fields: grupoTravelFields },
        { title: "Informações Pessoais", fields: personalInfoFields },
      ];
    }
    // motorista
    return [
      { title: "Dados do Motorista", fields: motoristaFields },
      { title: "Informações Pessoais", fields: personalInfoFields },
    ];
  }, [tipo, tipoViagem]);

  const currentStep = steps[step] || steps[0];
  const isLast = step === steps.length - 1;

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    onSubmit(formData);
    setStep(0);
    setFormData({});
    onOpenChange(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setStep(0);
      setFormData({});
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Ferramentas do Desenvolvedor
          </DialogTitle>
          <DialogDescription>
            Preencha o formulário abaixo para enviar um teste de webhook. Os dados aparecerão em "Testes Recebidos".
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i === step
                    ? "bg-primary text-primary-foreground"
                    : i < step
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              {i < steps.length - 1 && <div className="w-6 h-px bg-border" />}
            </div>
          ))}
          <span className="ml-2 text-sm font-medium text-foreground">{currentStep.title}</span>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          {currentStep.fields.map((field) => (
            <FieldRenderer
              key={field.key}
              field={field}
              value={formData[field.key] || ""}
              onChange={(v) => updateField(field.key, v)}
            />
          ))}
        </div>

        {/* JSON Preview */}
        <details className="mt-4">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            Visualizar payload JSON
          </summary>
          <pre className="mt-2 rounded-lg bg-muted p-3 text-xs font-mono overflow-x-auto max-h-40 text-foreground">
            {JSON.stringify(formData, null, 2)}
          </pre>
        </details>

        {/* Navigation */}
        <div className="flex justify-between mt-4">
          <Button
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>

          {isLast ? (
            <Button onClick={handleSubmit}>
              <Send className="h-4 w-4 mr-1" /> Enviar Teste
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)}>
              Próximo <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
