import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";

export default function GooglePage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Coloque Sua Empresa no Google",
      description: "Crie seu perfil no Google Business Profile e apareça nas buscas quando clientes procurarem por transporte executivo na sua região.",
    },
    {
      title: "Perfil Verificado no Google",
      description: "Motoristas com perfil verificado passam mais confiança. Hotéis e empresas encontram você diretamente no Google Maps.",
    },
    {
      title: "Aumente Sua Visibilidade",
      description: "Destaque-se nos resultados de busca com avaliações positivas e informações completas do seu serviço.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Carousel */}
      <div className="relative rounded-xl overflow-hidden bg-gradient-to-r from-primary/80 to-primary h-80 flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-2 z-10 bg-background/30 hover:bg-background/50 text-primary-foreground"
          onClick={() => setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="px-12 max-w-2xl">
          <h2 className="text-2xl font-bold text-primary-foreground mb-2">{slides[currentSlide].title}</h2>
          <p className="text-primary-foreground/80">{slides[currentSlide].description}</p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 z-10 bg-background/30 hover:bg-background/50 text-primary-foreground"
          onClick={() => setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${i === currentSlide ? "bg-primary-foreground" : "bg-primary-foreground/40"}`}
              onClick={() => setCurrentSlide(i)}
            />
          ))}
        </div>
      </div>

      {/* Google Business Profile */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Google Business Profile</h2>
          <p className="text-muted-foreground">Gerencie perfis para Google Meu Negócio</p>
        </div>
        <Button className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Novo Perfil
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Como funciona</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Preencha os dados do perfil no wizard. O sistema valida automaticamente o nome, categoria e endereço para reduzir chances de suspensão pelo Google. Motoristas sem ponto fixo devem ser configurados como "Service Area Business".
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." className="pl-9" />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Validado</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Carregando...
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
