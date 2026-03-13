import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function EmailBusinessPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">E-mail Business</h1>
          <p className="text-muted-foreground">Gerencie seus e-mails corporativos</p>
        </div>
        <Button variant="outline" size="icon">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}
