import { RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TransferSolicitacoesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitações de Transfer</h1>
          <p className="text-muted-foreground">Registros recebidos via webhook do site. Converta em reserva para confirmar.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Exportar CSV</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3">Solicitações Recebidas</h3>
        <p className="text-sm text-muted-foreground">Nenhuma solicitação recebida.</p>
      </div>
    </div>
  );
}
