import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function AnotacoesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Anotações</h1>
          <p className="text-muted-foreground">Crie e gerencie anotações e documentos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Nova Anotação
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar anotação..." className="pl-9" />
      </div>

      <p className="text-sm text-muted-foreground">Carregando...</p>
    </div>
  );
}
