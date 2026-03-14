import { MapPin } from "lucide-react";

export default function TaxiAbrangencia() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MapPin className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Abrangência</h1>
      </div>
      <p className="text-muted-foreground">Defina sua área de atuação.</p>
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Configuração de abrangência em breve.
      </div>
    </div>
  );
}
