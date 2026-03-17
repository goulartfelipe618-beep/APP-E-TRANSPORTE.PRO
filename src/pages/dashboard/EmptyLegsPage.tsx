import { Plane } from "lucide-react";
import SlideCarousel from "@/components/SlideCarousel";
import { Card, CardContent } from "@/components/ui/card";

export default function EmptyLegsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Plane className="h-6 w-6 text-primary" />
          Empty Legs
        </h1>
        <p className="text-muted-foreground mt-1">
          Voos comerciais dentro do Brasil com até <span className="font-bold text-primary">70% de desconto</span>
        </p>
      </div>

      <SlideCarousel pagina="empty_legs" />

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6 space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" />
            O que são Empty Legs?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Empty Legs são trechos de voos que estariam vazios — quando a aeronave precisa retornar à base ou seguir para outro destino sem passageiros.
            Isso permite oferecer passagens aéreas com descontos de até <strong className="text-primary">70%</strong> em relação ao preço normal.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ideal para quem tem flexibilidade de datas e quer economizar em viagens domésticas pelo Brasil.
          </p>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-muted-foreground py-4">
        Em breve: listagem de voos disponíveis com preços exclusivos.
      </div>
    </div>
  );
}
