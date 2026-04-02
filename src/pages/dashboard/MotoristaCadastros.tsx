import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, LayoutGrid, List } from "lucide-react";
import CadastrarMotoristaDialog from "@/components/motoristas/CadastrarMotoristaDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MOTORISTA_FROM_SOLICITACAO_KEY, type MotoristaInitialData } from "@/lib/motoristaFromSolicitacao";

export default function MotoristaCadastrosPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [open, setOpen] = useState(false);
  const [fromSolicitacao, setFromSolicitacao] = useState<MotoristaInitialData | null>(null);

  const consumeSessionPayload = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(MOTORISTA_FROM_SOLICITACAO_KEY);
      if (!raw) return;
      sessionStorage.removeItem(MOTORISTA_FROM_SOLICITACAO_KEY);
      const parsed = JSON.parse(raw) as MotoristaInitialData;
      if (parsed?.solicitacao_id) {
        setFromSolicitacao(parsed);
        setOpen(true);
      }
    } catch {
      sessionStorage.removeItem(MOTORISTA_FROM_SOLICITACAO_KEY);
      toast.error("Não foi possível carregar os dados da solicitação.");
    }
  }, []);

  useEffect(() => {
    consumeSessionPayload();
  }, [consumeSessionPayload]);

  const handleCreated = async () => {
    const sid = fromSolicitacao?.solicitacao_id;
    if (sid) {
      const { error } = await supabase.from("solicitacoes_motoristas").update({ status: "cadastrado" }).eq("id", sid);
      if (error) toast.error("Cadastro validado, mas não foi possível atualizar o status da solicitação.");
      else toast.success("Solicitação marcada como cadastrada.");
    }
    setFromSolicitacao(null);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setFromSolicitacao(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cadastros de Motoristas</h1>
          <p className="text-muted-foreground">Gerenciamento completo de motoristas</p>
        </div>
        <Button
          onClick={() => {
            setFromSolicitacao(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Novo motorista
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou CPF..." className="pl-9" />
        </div>
        <div className="flex overflow-hidden rounded-lg border border-border">
          <Button variant={viewMode === "grid" ? "default" : "ghost"} size="icon" onClick={() => setViewMode("grid")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === "list" ? "default" : "ghost"} size="icon" onClick={() => setViewMode("list")}>
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-center py-20 text-muted-foreground">Nenhum motorista cadastrado.</div>

      <CadastrarMotoristaDialog
        open={open}
        onOpenChange={handleOpenChange}
        onCreated={handleCreated}
        initialData={fromSolicitacao}
      />
    </div>
  );
}
