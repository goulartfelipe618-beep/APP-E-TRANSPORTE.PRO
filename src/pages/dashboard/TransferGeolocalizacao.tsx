import { useState } from "react";
import { Plus } from "lucide-react";
import SlideCarousel from "@/components/SlideCarousel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function TransferGeolocalizacaoPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <SlideCarousel
        pagina="geolocalizacao"
        fallbackSlides={[
          {
            titulo: "Geolocalização",
            subtitulo: "Links de rastreamento e localização durante o transfer",
            mostrar_texto: true,
          },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Geolocalização de Clientes</h1>
          <p className="text-muted-foreground">Gere links para rastrear a localização do cliente durante a viagem</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Novo Link</Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold text-foreground mb-3">Links de Rastreamento</h3>
        <p className="text-sm text-muted-foreground">Nenhum link de rastreamento criado.</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar Link de Rastreamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Reserva de Transfer *</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Selecione uma reserva" /></SelectTrigger>
                <SelectContent><SelectItem value="none">Nenhuma reserva</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria *</Label>
              <Select defaultValue="cliente">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="motorista">Motorista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nome (opcional)</Label><Input placeholder="Ex: João Silva" /></div>
            <div><Label>Telefone (opcional)</Label><Input placeholder="(__) _____-____" /></div>
            <div><Label>Observações (opcional)</Label><Textarea placeholder="Digite observações sobre o rastreamento..." /></div>
            <Button className="w-full">Criar Link</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
