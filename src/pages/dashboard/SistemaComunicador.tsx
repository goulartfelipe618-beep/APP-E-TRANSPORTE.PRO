import { Button } from "@/components/ui/button";
import { RefreshCw, QrCode } from "lucide-react";

export default function SistemaComunicadorPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comunicador</h1>
          <p className="text-muted-foreground">Conecte seu WhatsApp e configure webhooks para automações</p>
        </div>
        <Button variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <QrCode className="h-5 w-5 text-foreground" />
          <h3 className="font-semibold text-foreground">Conectar WhatsApp</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Gere um QR Code para conectar seu WhatsApp e habilitar as automações do sistema.
        </p>

        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
            <QrCode className="h-16 w-16 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Clique abaixo para gerar o QR Code da Evolution API</p>
          <Button className="bg-primary text-primary-foreground">
            <QrCode className="h-4 w-4 mr-2" /> Gerar QR Code
          </Button>
        </div>
      </div>
    </div>
  );
}
