import { Activity } from "lucide-react";

export default function TaxiMetricas() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Métricas</h1>
      </div>
      <p className="text-muted-foreground">Acompanhe as métricas do seu serviço de táxi.</p>
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Métricas em breve.
      </div>
    </div>
  );
}
