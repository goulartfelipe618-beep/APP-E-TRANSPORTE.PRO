import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function CampanhasLeadsPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground">Gerencie todos os leads capturados</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Exportar CSV</Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Novo Lead</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Campanha</label>
            <Select defaultValue="all">
              <SelectTrigger><SelectValue placeholder="Todas as Campanhas" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas as Campanhas</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Status</label>
            <Select defaultValue="all">
              <SelectTrigger><SelectValue placeholder="Todos os Status" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos os Status</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3">Todos os Leads</h3>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
            <DialogDescription>Adicione um lead manualmente.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div><Label>Nome *</Label><Input /></div>
            <div><Label>E-mail</Label><Input type="email" /></div>
            <div><Label>Telefone/WhatsApp *</Label><Input /></div>
            <div>
              <Label>Campanha de Origem</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent><SelectItem value="none">Nenhuma</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select defaultValue="novo">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="contato">Em Contato</SelectItem>
                  <SelectItem value="convertido">Convertido</SelectItem>
                  <SelectItem value="perdido">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Textarea placeholder="Notas sobre o lead..." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valor da Venda (R$)</Label><Input type="number" placeholder="0,00" /></div>
              <div><Label>Data da Conversão</Label><Input type="date" /></div>
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
