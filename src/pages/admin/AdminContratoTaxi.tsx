import { FileText } from "lucide-react";

export default function AdminContratoTaxi() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          Contrato — Táxi
        </h1>
        <p className="text-muted-foreground mt-1">Gerencie o produto Táxi disponível na plataforma.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-semibold text-foreground mb-1">Produto Táxi</h3>
        <p className="text-sm text-muted-foreground">Configure preços, regras, termos e condições do produto Táxi aqui.</p>
      </div>
    </div>
  );
}
