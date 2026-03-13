import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import CriarReservaGrupoDialog from "@/components/grupos/CriarReservaGrupoDialog";

export default function GruposReservasPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reservas de Grupos</h1>
          <p className="text-muted-foreground">Reservas convertidas a partir de solicitações de grupos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button className="bg-primary text-primary-foreground" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Criar Reserva
          </Button>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3">Reservas Ativas</h3>
        <p className="text-sm text-muted-foreground">Nenhuma reserva encontrada.</p>
      </div>

      <CriarReservaGrupoDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
