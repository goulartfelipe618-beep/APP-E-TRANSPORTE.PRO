import { Users } from "lucide-react";

export default function TaxiClientesCorridas() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Clientes / Corridas</h1>
      </div>
      <p className="text-muted-foreground">Gerencie seus clientes e histórico de corridas.</p>
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Nenhum registro encontrado.
      </div>
    </div>
  );
}
