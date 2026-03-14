import { Phone } from "lucide-react";

export default function TaxiChamadas() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Phone className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Chamadas</h1>
      </div>
      <p className="text-muted-foreground">Gerencie as chamadas de corrida recebidas.</p>
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Nenhuma chamada no momento.
      </div>
    </div>
  );
}
