import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Download } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { badgeToneReservaStatus, labelReservaStatus } from "@/lib/reservaStatus";

type Reserva = Tables<"reservas_transfer">;

const tipoLabel: Record<string, string> = {
  somente_ida: "Somente Ida",
  ida_volta: "Ida e Volta",
  por_hora: "Por Hora",
};

interface Props {
  reserva: Reserva | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComunicar: (r: Reserva) => void;
  onDownload: (r: Reserva) => void;
}

export default function DetalhesReservaTransferSheet({ reserva, open, onOpenChange, onComunicar, onDownload }: Props) {
  if (!reserva) return null;

  const r = reserva;
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : null;
  const formatCurrency = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes da Reserva</SheetTitle>
          <p className="text-sm text-muted-foreground">Reserva #{r.numero_reserva}</p>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          {/* Cliente */}
          <Section title="Informações do Cliente">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cliente" value={r.nome_completo} />
              <Field label="CPF/CNPJ" value={r.cpf_cnpj} />
              <Field label="Telefone" value={r.telefone} />
              <Field label="Email" value={r.email} />
              <Field label="Quem Viaja" value={r.quem_viaja === "motorista" ? "Motorista" : "Eu mesmo"} />
            </div>
          </Section>

          <Separator />

          {/* Viagem */}
          <Section title="Detalhes da Viagem">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de Viagem" value={tipoLabel[r.tipo_viagem] || r.tipo_viagem} />
              <Field
                label="Status"
                value={<Badge variant={badgeToneReservaStatus(r.status)}>{labelReservaStatus(r.status)}</Badge>}
              />
            </div>
          </Section>

          {/* IDA */}
          {(r.tipo_viagem === "somente_ida" || r.tipo_viagem === "ida_volta") && (
            <>
              <Separator />
              <Section title="→ Ida">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Embarque" value={r.ida_embarque} />
                  <Field label="Desembarque" value={r.ida_desembarque} />
                  <Field label="Data" value={formatDate(r.ida_data)} />
                  <Field label="Hora" value={r.ida_hora} />
                  <Field label="Passageiros" value={r.ida_passageiros?.toString()} />
                  <Field label="Cupom" value={r.ida_cupom} />
                </div>
                {r.ida_mensagem && <Field label="Mensagem" value={r.ida_mensagem} full />}
              </Section>
            </>
          )}

          {/* VOLTA */}
          {r.tipo_viagem === "ida_volta" && (
            <>
              <Separator />
              <Section title="⇆ Volta">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Embarque" value={r.volta_embarque} />
                  <Field label="Desembarque" value={r.volta_desembarque} />
                  <Field label="Data" value={formatDate(r.volta_data)} />
                  <Field label="Hora" value={r.volta_hora} />
                  <Field label="Passageiros" value={r.volta_passageiros?.toString()} />
                  <Field label="Cupom" value={r.volta_cupom} />
                </div>
                {r.volta_mensagem && <Field label="Mensagem" value={r.volta_mensagem} full />}
              </Section>
            </>
          )}

          {/* POR HORA */}
          {r.tipo_viagem === "por_hora" && (
            <>
              <Separator />
              <Section title="⏱ Por Hora">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Endereço Início" value={r.por_hora_endereco_inicio} />
                  <Field label="Ponto Encerramento" value={r.por_hora_ponto_encerramento} />
                  <Field label="Data" value={formatDate(r.por_hora_data)} />
                  <Field label="Hora" value={r.por_hora_hora} />
                  <Field label="Passageiros" value={r.por_hora_passageiros?.toString()} />
                  <Field label="Qtd. Horas" value={r.por_hora_qtd_horas?.toString()} />
                  <Field label="Cupom" value={r.por_hora_cupom} />
                </div>
                {r.por_hora_itinerario && <Field label="Itinerário" value={r.por_hora_itinerario} full />}
              </Section>
            </>
          )}

          <Separator />

          {/* Valores */}
          <Section title="Valores e Pagamento">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor Base" value={formatCurrency(r.valor_base)} />
              <Field label="Desconto" value={`${Number(r.desconto)}%`} />
              <Field label="Método de Pagamento" value={r.metodo_pagamento} />
              <Field label="Valor Total" value={<span className="text-base font-bold text-primary">{formatCurrency(r.valor_total)}</span>} />
              <Field
                label="Repasse ao motorista"
                value={
                  r.repasse_motorista != null && Number(r.repasse_motorista) > 0
                    ? formatCurrency(Number(r.repasse_motorista))
                    : "—"
                }
              />
            </div>
          </Section>

          {r.observacoes && (
            <>
              <Separator />
              <Section title="Observações">
                <p className="text-sm bg-muted/50 rounded-lg p-3">{r.observacoes}</p>
              </Section>
            </>
          )}

          <div className="text-xs text-muted-foreground pt-2">
            Criada em {new Date(r.created_at).toLocaleString("pt-BR")}
          </div>

          <div className="flex gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => onComunicar(r)} className="flex-1">
              <MessageSquare className="h-4 w-4 mr-2" /> Comunicar
            </Button>
            <Button variant="outline" onClick={() => onDownload(r)} className="flex-1">
              <Download className="h-4 w-4 mr-2" /> Download
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

function Field({ label, value, full }: { label: string; value: React.ReactNode | string | null | undefined; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}
