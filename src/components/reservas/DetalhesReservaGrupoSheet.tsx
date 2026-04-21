import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Download } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { badgeToneReservaStatus, labelReservaStatus } from "@/lib/reservaStatus";

type ReservaGrupo = Tables<"reservas_grupos">;

const veiculoLabel: Record<string, string> = {
  van: "Van",
  micro_onibus: "Micro-ônibus",
  onibus: "Ônibus",
};

interface Props {
  reserva: ReservaGrupo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComunicar: (r: ReservaGrupo) => void;
  onDownload: (r: ReservaGrupo) => void;
}

export default function DetalhesReservaGrupoSheet({ reserva, open, onOpenChange, onComunicar, onDownload }: Props) {
  if (!reserva) return null;

  const r = reserva;
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : null;
  const formatCurrency = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes da Reserva de Grupo</SheetTitle>
          <p className="text-sm text-muted-foreground">Reserva #{r.numero_reserva}</p>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          {/* Cliente */}
          <Section title="Informações do Cliente">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cliente" value={r.nome_completo} />
              <Field label="CPF/CNPJ" value={r.cpf_cnpj} />
              <Field label="WhatsApp" value={r.whatsapp} />
              <Field label="Email" value={r.email} />
            </div>
          </Section>

          <Separator />

          {/* Viagem */}
          <Section title="Detalhes da Viagem">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Veículo" value={r.tipo_veiculo ? veiculoLabel[r.tipo_veiculo] || r.tipo_veiculo : null} />
              <Field label="Passageiros" value={r.num_passageiros?.toString()} />
              <Field label="Embarque" value={r.embarque} />
              <Field label="Destino" value={r.destino} />
              <Field label="Data Ida" value={formatDate(r.data_ida)} />
              <Field label="Hora Ida" value={r.hora_ida} />
              <Field label="Data Retorno" value={formatDate(r.data_retorno)} />
              <Field label="Hora Retorno" value={r.hora_retorno} />
              <Field
                label="Status"
                value={<Badge variant={badgeToneReservaStatus(r.status)}>{labelReservaStatus(r.status)}</Badge>}
              />
              <Field label="Cupom" value={r.cupom} />
            </div>
          </Section>

          <Separator />

          {/* Motorista */}
          <Section title="Motorista">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome Motorista" value={r.nome_motorista} />
              <Field label="Telefone Motorista" value={r.telefone_motorista} />
            </div>
          </Section>

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

          {r.observacoes_viagem && (
            <>
              <Separator />
              <Section title="Observações">
                <p className="text-sm bg-muted/50 rounded-lg p-3">{r.observacoes_viagem}</p>
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

function Field({ label, value }: { label: string; value: React.ReactNode | string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}
