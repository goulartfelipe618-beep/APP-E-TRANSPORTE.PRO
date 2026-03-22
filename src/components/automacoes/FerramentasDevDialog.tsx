import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Code2, Copy, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface FerramentasDevDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: string;
  onSubmit: (payload: Record<string, string>) => void;
}

interface FieldDoc {
  variable: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

// Fallback hardcoded personal fields (always included)
const personalFieldsFallback: FieldDoc[] = [
  { variable: "nome_completo", label: "Nome Completo", type: "text", required: true },
  { variable: "telefone", label: "Número de Telefone", type: "text", required: true },
  { variable: "email", label: "E-mail", type: "email", required: true },
  { variable: "como_encontrou", label: "Por onde nos encontrou?", type: "select", options: ["Google", "Instagram", "Facebook", "Indicação", "Outro"] },
];

function fieldNameToDoc(name: string): FieldDoc {
  const lower = name.toLowerCase();
  let type = "text";
  if (lower.includes("data") || lower.includes("nascimento")) type = "date";
  else if (lower.includes("hora") || lower.includes("horário")) type = "time";
  else if (lower.includes("email") || lower.includes("e-mail")) type = "email";
  else if (lower.includes("passageiro") || lower.includes("qtd") || lower.includes("número") || lower.includes("ano")) type = "number";
  else if (lower.includes("mensagem") || lower.includes("observ") || lower.includes("itinerário") || lower.includes("experiência")) type = "textarea";

  const variable = name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  return { variable, label: name, type };
}

function FieldTable({ fields, sectionTitle }: { fields: FieldDoc[]; sectionTitle: string }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">{sectionTitle}</h4>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Variável</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Campo</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => (
              <tr key={f.variable} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                <td className="px-3 py-1.5">
                  <code className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">{f.variable}</code>
                </td>
                <td className="px-3 py-1.5 text-foreground">{f.label}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{f.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function buildJsonExample(fields: FieldDoc[]): Record<string, string> {
  const obj: Record<string, string> = {};
  fields.forEach((f) => {
    if (f.type === "date") obj[f.variable] = "2025-01-15";
    else if (f.type === "time") obj[f.variable] = "14:30";
    else if (f.type === "number") obj[f.variable] = "2";
    else if (f.type === "email") obj[f.variable] = "cliente@email.com";
    else if (f.options) obj[f.variable] = f.options[0];
    else obj[f.variable] = `valor_${f.variable}`;
  });
  return obj;
}

function CopyJsonButton({
  label, fields, onCopy, copied,
}: {
  label: string; fields: FieldDoc[];
  onCopy: (label: string, fields: FieldDoc[]) => void; copied: string | null;
}) {
  return (
    <Button variant="outline" size="sm" className="w-full" onClick={() => onCopy(label, fields)}>
      <Copy className="h-3.5 w-3.5 mr-2" />
      {copied === label ? "Copiado!" : `Copiar JSON de exemplo — ${label}`}
    </Button>
  );
}

export default function FerramentasDevDialog({ open, onOpenChange, tipo }: FerramentasDevDialogProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dynamicFields, setDynamicFields] = useState<Record<string, FieldDoc[]>>({});

  // Fetch fields from automacoes_campos_config
  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("automacoes_campos_config" as any)
        .select("*")
        .eq("categoria", tipo) as any;

      const result: Record<string, FieldDoc[]> = {};
      if (!error && data) {
        for (const row of data) {
          const campos: string[] = Array.isArray(row.campos) ? row.campos : [];
          result[row.subcategoria] = campos.filter(c => c.trim()).map(fieldNameToDoc);
        }
      }
      setDynamicFields(result);
      setLoading(false);
    })();
  }, [open, tipo]);

  const copyJson = (label: string, fields: FieldDoc[]) => {
    const allFields = [...fields, ...personalFieldsFallback];
    const json = JSON.stringify(buildJsonExample(allFields), null, 2);
    navigator.clipboard.writeText(json);
    setCopiedSection(label);
    toast.success(`JSON de exemplo (${label}) copiado!`);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const getFieldsForSub = (sub: string): FieldDoc[] => {
    return dynamicFields[sub] || [];
  };

  const renderTransfer = () => (
    <Tabs defaultValue="somente_ida" className="space-y-4">
      <TabsList className="w-full grid grid-cols-3">
        <TabsTrigger value="somente_ida">Somente Ida</TabsTrigger>
        <TabsTrigger value="ida_volta">Ida e Volta</TabsTrigger>
        <TabsTrigger value="por_hora">Por Hora</TabsTrigger>
      </TabsList>

      {["somente_ida", "ida_volta", "por_hora"].map((sub) => {
        const fields = getFieldsForSub(sub);
        const label = sub === "somente_ida" ? "Somente Ida" : sub === "ida_volta" ? "Ida e Volta" : "Por Hora";
        return (
          <TabsContent key={sub} value={sub} className="space-y-4">
            {fields.length > 0 ? (
              <FieldTable fields={fields} sectionTitle={`Dados da Viagem — ${label}`} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum campo configurado para "{label}". Configure os campos no menu Automações do painel administrativo.
              </p>
            )}
            <FieldTable fields={personalFieldsFallback} sectionTitle="Informações Pessoais" />
            <CopyJsonButton label={label} fields={fields} onCopy={copyJson} copied={copiedSection} />
          </TabsContent>
        );
      })}
    </Tabs>
  );

  const renderGrupo = () => {
    const fields = getFieldsForSub("default");
    return (
      <div className="space-y-4">
        {fields.length > 0 ? (
          <FieldTable fields={fields} sectionTitle="Dados da Viagem em Grupo" />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum campo configurado. Configure os campos no menu Automações do painel administrativo.
          </p>
        )}
        <FieldTable fields={personalFieldsFallback} sectionTitle="Informações Pessoais" />
        <CopyJsonButton label="Grupo" fields={fields} onCopy={copyJson} copied={copiedSection} />
      </div>
    );
  };

  const renderMotorista = () => {
    const fields = getFieldsForSub("default");
    return (
      <div className="space-y-4">
        {fields.length > 0 ? (
          <FieldTable fields={fields} sectionTitle="Dados do Motorista" />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum campo configurado. Configure os campos no menu Automações do painel administrativo.
          </p>
        )}
        <FieldTable fields={personalFieldsFallback} sectionTitle="Informações Pessoais" />
        <CopyJsonButton label="Motorista" fields={fields} onCopy={copyJson} copied={copiedSection} />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Ferramentas do Desenvolvedor
          </DialogTitle>
          <DialogDescription>
            Documentação dos campos e variáveis necessárias para os formulários externos. Os campos são sincronizados automaticamente com as configurações definidas pelo administrador.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-foreground space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <FileText className="h-4 w-4 text-primary" />
            Instruções
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            O formulário externo deve enviar um <code className="bg-muted px-1 rounded font-mono">POST</code> para a URL do webhook com um JSON contendo as variáveis listadas abaixo. 
            Cada campo possui sua variável correspondente (coluna "Variável") que deve ser usada como chave no JSON. 
            Após o envio, os dados aparecerão em "Testes Recebidos". Mapeie as variáveis no painel de "Mapeamento de Campos" e ative o webhook.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {tipo === "transfer" && renderTransfer()}
            {tipo === "grupo" && renderGrupo()}
            {tipo === "motorista" && renderMotorista()}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
