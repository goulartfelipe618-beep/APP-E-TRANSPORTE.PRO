import { Car, Phone, CheckCircle, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SlideCarousel from "@/components/SlideCarousel";

export default function TaxiHome() {
  const cards = [
    { title: "Chamadas Pendentes", value: "0", icon: Phone, color: "text-amber-500" },
    { title: "Atendimentos Confirmados", value: "0", icon: CheckCircle, color: "text-emerald-500" },
    { title: "Corridas Realizadas", value: "0", icon: Car, color: "text-primary" },
    { title: "Clientes Cadastrados", value: "0", icon: Users, color: "text-blue-500" },
  ];

  return (
    <div className="space-y-6">
      <SlideCarousel pagina="home_taxi" />

      <h1 className="text-2xl font-bold text-foreground">Painel do Taxista</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
