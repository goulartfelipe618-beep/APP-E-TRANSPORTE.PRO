import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function SistemaAutomacoesPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automações</h1>
          <p className="text-muted-foreground">Gerencie seus webhooks e mapeamentos de campos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Nova Automação</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Automação</DialogTitle>
            <DialogDescription>Dê um nome e selecione o tipo de automação.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div><Label>Nome da Automação</Label><Input placeholder="Ex: Formulário do site principal" /></div>
            <div>
              <Label>Tipo de Automação</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>CATEGORIAS DO SISTEMA</SelectLabel>
                    <SelectItem value="transfer">Transfer Executivo</SelectItem>
                    <SelectItem value="motorista">Solicitação Motorista</SelectItem>
                    <SelectItem value="grupo">Solicitação de Grupo</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button>Criar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
