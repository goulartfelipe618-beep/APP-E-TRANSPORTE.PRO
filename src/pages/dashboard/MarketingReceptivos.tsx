import { Button } from "@/components/ui/button";
import { RefreshCw, Plus } from "lucide-react";

export default function MarketingReceptivosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Receptivos</h1>
          <p className="text-muted-foreground">Gerencie seus pontos receptivos de marketing</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Novo Receptivo
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3">Todos os Receptivos</h3>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}
