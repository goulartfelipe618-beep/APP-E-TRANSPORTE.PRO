import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const CAMPAIGN_COLORS = [
  "#3B82F6", "#10B981", "#F43F5E", "#F59E0B",
  "#A78BFA", "#F97316", "#EC4899", "#06B6D4",
];

export default function CampanhasAtivosPage() {
  const [open, setOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(CAMPAIGN_COLORS[0]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campanhas Ativas</h1>
          <p className="text-muted-foreground">Gerencie suas campanhas de marketing</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon"><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Nova Campanha</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3">Todas as Campanhas</h3>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Campanha</DialogTitle>
            <DialogDescription>Crie uma campanha e receba um webhook para capturar leads automaticamente.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div><Label>Nome da Campanha *</Label><Input placeholder="Ex: Facebook Ads - Aluguel de Luxo" /></div>
            <div><Label>Plataforma/Fonte</Label><Input placeholder="Ex: Google, Meta, Landing Page" /></div>
            <div><Label>Link da Campanha</Label><Input placeholder="https://exemplo.com/campanha" /></div>
            <div>
              <Label>Cor da Campanha</Label>
              <div className="flex gap-2 mt-2">
                {CAMPAIGN_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-full transition-all ${selectedColor === color ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div><Label>Descrição</Label><Textarea placeholder="Descreva a campanha..." /></div>
            <div>
              <Label>Status</Label>
              <Select defaultValue="ativa">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="pausada">Pausada</SelectItem>
                  <SelectItem value="encerrada">Encerrada</SelectItem>
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
