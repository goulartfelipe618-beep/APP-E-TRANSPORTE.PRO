import { CheckCircle } from "lucide-react";

export default function TaxiAtendimentos() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CheckCircle className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Atendimentos Confirmados</h1>
      </div>
      <p className="text-muted-foreground">Visualize os atendimentos confirmados.</p>
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Nenhum atendimento confirmado.
      </div>
    </div>
  );
}
