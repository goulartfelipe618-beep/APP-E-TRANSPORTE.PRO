import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, ArrowRightLeft } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type SolicitacaoTransfer = Tables<"solicitacoes_transfer">;

interface Props {
  solicitacao: SolicitacaoTransfer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverter: (s: SolicitacaoTransfer) => void;
  onComunicar: (s: SolicitacaoTransfer) => void;
}

export default function DetalhesSolicitacaoTransferSheet({ solicitacao, open, onOpenChange, onConverter, onComunicar }: Props) {
  if (!solicitacao) return null;
  const s = solicitacao;
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : null;

  const isIdaVolta = s.tipo === "ida_volta";
  const isPorHora = s.tipo === "por_hora";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes da Solicitação</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          <Section title="Dados do Cliente">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cliente" value={s.nome_cliente} />
              <Field label="Contato" value={s.contato} />
              <Field label="Email" value={s.email} />
              <Field label="Tipo" value={s.tipo} />
              <Field label="Status" value={<Badge variant="outline">{s.status}</Badge>} />
            </div>
          </Section>

          <Separator />

          {/* Ida / Geral */}
          <Section title={isPorHora ? "⏱ Detalhes Por Hora" : "→ Detalhes da Ida"}>
            <div className="grid grid-cols-2 gap-3">
              {!isPorHora && (
                <>
                  <Field label="Embarque" value={s.embarque} />
                  <Field label="Desembarque" value={s.desembarque} />
                   <Field label="Data" value={formatDate(s.data_viagem)} />
                   <Field label="Hora" value={s.hora_viagem} />
                   <Field label="Passageiros" value={s.num_passageiros?.toString()} />
                   <Field label="Cupom" value={s.cupom} />
                </>
              )}
              {isPorHora && (
                <>
                   <Field label="Endereço Início" value={s.por_hora_endereco_inicio} />
                   <Field label="Ponto Encerramento" value={s.por_hora_ponto_encerramento} />
                   <Field label="Data" value={formatDate(s.por_hora_data)} />
                   <Field label="Hora" value={s.por_hora_hora} />
                   <Field label="Passageiros" value={s.por_hora_passageiros?.toString()} />
                   <Field label="Qtd. Horas" value={s.por_hora_qtd_horas?.toString()} />
                   <Field label="Cupom" value={s.por_hora_cupom} />
                </>
              )}
            </div>
            {!isPorHora && s.mensagem && <Field label="Mensagem" value={s.mensagem} />}
            {isPorHora && s.por_hora_itinerario && <Field label="Itinerário" value={s.por_hora_itinerario} />}
          </Section>

          {/* Volta */}
          {isIdaVolta && (
            <>
              <Separator />
              <Section title="⇆ Detalhes da Volta">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Embarque" value={(s as any).volta_embarque} />
                  <Field label="Desembarque" value={(s as any).volta_desembarque} />
                  <Field label="Data" value={formatDate((s as any).volta_data)} />
                  <Field label="Hora" value={(s as any).volta_hora} />
                  <Field label="Passageiros" value={(s as any).volta_passageiros?.toString()} />
                  <Field label="Cupom" value={(s as any).volta_cupom} />
                </div>
                {(s as any).volta_mensagem && <Field label="Mensagem" value={(s as any).volta_mensagem} />}
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
