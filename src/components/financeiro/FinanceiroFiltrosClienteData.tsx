import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FinanceiroClienteOpt } from "@/hooks/useFinanceiroFiltroCliente";

type Props = {
  filterDataDe: string;
  filterDataAte: string;
  onFilterDataDe: (v: string) => void;
  onFilterDataAte: (v: string) => void;
  filterCliente: string;
  onFilterCliente: (v: string) => void;
  clientes: FinanceiroClienteOpt[];
  filtrosAtivos: boolean;
  onLimpar: () => void;
  /** Rótulo do campo data (ex.: competência vs viagem). */
  dataLabel?: string;
};

export default function FinanceiroFiltrosClienteData({
  filterDataDe,
  filterDataAte,
  onFilterDataDe,
  onFilterDataAte,
  filterCliente,
  onFilterCliente,
  clientes,
  filtrosAtivos,
  onLimpar,
  dataLabel = "Data",
}: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-[#FF6600]" />
        <span className="text-sm font-medium text-foreground">Filtros</span>
        {filtrosAtivos ? (
          <Button type="button" variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={onLimpar}>
            <X className="mr-1 h-3.5 w-3.5" />
            Limpar
          </Button>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{dataLabel} (de)</Label>
          <Input type="date" value={filterDataDe} onChange={(e) => onFilterDataDe(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{dataLabel} (até)</Label>
          <Input type="date" value={filterDataAte} onChange={(e) => onFilterDataAte(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Cliente</Label>
          <Select value={filterCliente} onValueChange={onFilterCliente}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome_exibicao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
