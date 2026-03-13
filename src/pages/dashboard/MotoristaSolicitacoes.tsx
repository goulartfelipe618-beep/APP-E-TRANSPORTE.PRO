import { Button } from "@/components/ui/button";
import { RefreshCw, Download } from "lucide-react";

export default function MotoristaSolicitacoesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitações de Motoristas</h1>
          <p className="text-muted-foreground">Solicitações recebidas de pessoas que desejam ser motoristas parceiros.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3">Solicitações Recebidas</h3>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}
