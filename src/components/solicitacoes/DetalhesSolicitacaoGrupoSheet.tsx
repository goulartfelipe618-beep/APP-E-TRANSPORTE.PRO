import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, ArrowRightLeft } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type SolicitacaoGrupo = Tables<"solicitacoes_grupos">;

interface Props {
  solicitacao: SolicitacaoGrupo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverter: (s: SolicitacaoGrupo) => void;
  onComunicar: (s: SolicitacaoGrupo) => void;
}

export default function DetalhesSolicitacaoGrupoSheet({ solicitacao, open, onOpenChange, onConverter, onComunicar }: Props) {
  if (!solicitacao) return null;
  const s = solicitacao;
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes da Solicitação de Grupo</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          <Section title="Dados do Cliente">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cliente" value={s.nome_cliente} />
              <Field label="WhatsApp" value={s.whatsapp} />
              <Field label="Email" value={s.email} />
              <Field label="Status" value={<Badge variant="outline">{s.status}</Badge>} />
            </div>
          </Section>

          <Separator />

          <Section title="Detalhes da Viagem">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Veículo" value={s.tipo_veiculo} />
              <Field label="Passageiros" value={s.num_passageiros?.toString()} />
              <Field label="Embarque" value={s.embarque} />
              <Field label="Destino" value={s.destino} />
              <Field label="Data Ida" value={formatDate(s.data_ida)} />
              <Field label="Hora Ida" value={(s as any).hora_ida} />
              <Field label="Data Retorno" value={formatDate((s as any).data_retorno)} />
              <Field label="Hora Retorno" value={(s as any).hora_retorno} />
              <Field label="Cupom" value={(s as any).cupom} />
            </div>
          </Section>

          {s.mensagem && (
            <>
              <Separator />
              <Section title="Mensagem">
                <p className="text-sm bg-muted/50 rounded-lg p-3">{s.mensagem}</p>
              </Section>
            </>
          )}

          <div className="text-xs text-muted-foreground pt-2">
            Recebida em {new Date(s.created_at).toLocaleString("pt-BR")}
          </div>

          <div className="flex gap-2 pt-4 border-t border-border">
            {s.status === "pendente" && (
              <Button onClick={() => onConverter(s)} className="flex-1">
                <ArrowRightLeft className="h-4 w-4 mr-2" /> Converter em Reserva
              </Button>
            )}
            <Button variant="outline" onClick={() => onComunicar(s)} className="flex-1">
              <MessageSquare className="h-4 w-4 mr-2" /> Comunicar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode | string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}
